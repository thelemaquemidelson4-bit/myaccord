import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme/theme";
import { api, getToken, wsUrl } from "@/src/api/client";
import { ICE_SERVERS } from "@/src/webrtc/config";
import {
  webrtcAvailable,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from "@/src/webrtc/rtc";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roomId, role, title, media } = useLocalSearchParams<{
    roomId: string; role?: string; title?: string; media?: string;
  }>();
  const isHost = role === "host";
  const isVideo = media !== "audio";

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<any>(null);
  const peersRef = useRef<Record<string, any>>({});
  const pcRef = useRef<any>(null); // viewer single pc
  const pendingCandidates = useRef<Record<string, any[]>>({});

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [viewers, setViewers] = useState(0);
  const [status, setStatus] = useState<"connecting" | "live" | "ended" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);

  const cleanup = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    Object.values(peersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
    peersRef.current = {};
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    try { localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
  }, []);

  const endLive = useCallback(async () => {
    if (isHost) { try { await api.post(`/lives/${roomId}/end`); } catch {} }
    cleanup();
    router.back();
  }, [cleanup, isHost, roomId, router]);

  // HOST: create a dedicated peer connection per viewer and push our stream.
  const createOfferForViewer = useCallback(async (viewerId: string) => {
    if (peersRef.current[viewerId]) return;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[viewerId] = pc;
    localStreamRef.current?.getTracks?.().forEach((t: any) => pc.addTrack(t, localStreamRef.current));
    pc.onicecandidate = (e: any) => {
      if (e.candidate) wsRef.current?.send(JSON.stringify({ type: "candidate", candidate: e.candidate, to: viewerId }));
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "closed" || st === "disconnected") {
        try { pc.close(); } catch {}
        delete peersRef.current[viewerId];
        setViewers(Object.keys(peersRef.current).length);
      }
    };
    setViewers(Object.keys(peersRef.current).length);
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: "offer", sdp: pc.localDescription, to: viewerId }));
  }, []);

  const handleHostSignal = useCallback(async (msg: any) => {
    switch (msg.type) {
      case "peer-joined": createOfferForViewer(msg.user_id); break;
      case "peers": (msg.peers || []).forEach((p: any) => createOfferForViewer(p.user_id)); break;
      case "answer": {
        const pc = peersRef.current[msg.from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          for (const c of (pendingCandidates.current[msg.from] || [])) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          pendingCandidates.current[msg.from] = [];
        }
        break;
      }
      case "candidate": {
        const pc = peersRef.current[msg.from];
        if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
        else { (pendingCandidates.current[msg.from] ||= []).push(msg.candidate); }
        break;
      }
      case "peer-left": {
        const pc = peersRef.current[msg.user_id];
        if (pc) { try { pc.close(); } catch {} delete peersRef.current[msg.user_id]; setViewers(Object.keys(peersRef.current).length); }
        break;
      }
    }
  }, [createOfferForViewer]);

  // VIEWER: single connection that receives the host stream.
  const hostIdRef = useRef<string | null>(null);
  const handleViewerSignal = useCallback(async (msg: any) => {
    switch (msg.type) {
      case "offer": {
        hostIdRef.current = msg.from;
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;
        pc.ontrack = (e: any) => { if (e.streams && e.streams[0]) { setRemoteStream(e.streams[0]); setStatus("live"); } };
        pc.onicecandidate = (e: any) => {
          if (e.candidate && hostIdRef.current) wsRef.current?.send(JSON.stringify({ type: "candidate", candidate: e.candidate, to: hostIdRef.current }));
        };
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of (pendingCandidates.current["host"] || [])) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        pendingCandidates.current["host"] = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: "answer", sdp: pc.localDescription, to: msg.from }));
        break;
      }
      case "candidate": {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
        else { (pendingCandidates.current["host"] ||= []).push(msg.candidate); }
        break;
      }
      case "peer-left": {
        setStatus("ended");
        setErrorMsg("Le direct est terminé.");
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!webrtcAvailable) { setStatus("error"); return; }
    let cancelled = false;
    (async () => {
      try {
        if (isHost) {
          const stream = await mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: "user" } : false });
          if (cancelled) { stream.getTracks().forEach((t: any) => t.stop()); return; }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setStatus("live");
        }
        const token = await getToken();
        const ws = new WebSocket(wsUrl(`/ws/signal/${roomId}`, token));
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (isHost) handleHostSignal(msg); else handleViewerSignal(msg);
          } catch {}
        };
        ws.onerror = () => { setStatus("error"); setErrorMsg("Connexion au serveur impossible."); };
      } catch (e: any) {
        setStatus("error");
        setErrorMsg("Accès caméra/micro refusé. Autorisez-les dans les réglages.");
      }
    })();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks?.().forEach((t: any) => { t.enabled = next; });
    setMicOn(next);
  };
  const switchCam = () => {
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => { try { t._switchCamera(); } catch {} });
  };

  if (!webrtcAvailable) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="radio-outline" size={48} color={colors.onSurfaceInverse} />
        <AppText variant="displaySm" color={colors.onSurfaceInverse} center style={{ marginTop: spacing.lg }}>
          Direct non disponible ici
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.7)" center style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
          La diffusion en direct nécessite un build natif (iOS/Android). Elle ne fonctionne pas dans Expo Go ni sur l'aperçu web. Publiez l'app puis générez un build pour l'utiliser.
        </AppText>
        <Button title="Retour" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.xl }} testID="live-back-web" />
      </View>
    );
  }

  const showStream = isHost ? localStream : remoteStream;

  return (
    <View style={styles.container}>
      {isVideo && showStream ? (
        <RTCView stream={showStream} streamURL={showStream.toURL?.()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isHost} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={styles.avatarBig}><Ionicons name="mic" size={64} color={colors.onSurfaceInverse} /></View>
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + spacing.md }]}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <AppText variant="caption" weight="bold" color="#FFFFFF">DIRECT</AppText>
        </View>
        {isHost && (
          <View style={styles.viewerPill}>
            <Ionicons name="eye" size={14} color="#FFFFFF" />
            <AppText variant="caption" weight="semibold" color="#FFFFFF" style={{ marginLeft: 4 }} testID="live-viewers">{viewers}</AppText>
          </View>
        )}
      </View>

      {!!title && (
        <View style={[styles.titleBar, { top: insets.top + spacing.md + 44 }]}>
          <AppText variant="label" color={colors.onSurfaceInverse} numberOfLines={2}>{title}</AppText>
        </View>
      )}

      {status === "connecting" && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.onSurfaceInverse} size="large" />
          <AppText variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: spacing.md }}>
            {isHost ? "Démarrage du direct…" : "Connexion au direct…"}
          </AppText>
        </View>
      )}

      {(status === "ended" || status === "error") && errorMsg && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText variant="body" color={colors.onSurfaceInverse} center style={{ paddingHorizontal: spacing.xl }}>{errorMsg}</AppText>
          {errorMsg.includes("réglages") && (
            <Button title="Ouvrir les réglages" variant="ghost" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.lg }} testID="live-settings" />
          )}
          <Button title="Retour" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} testID="live-back" />
        </View>
      )}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
        {isHost && (
          <Pressable testID="live-mic" onPress={toggleMic} style={[styles.ctrl, !micOn && styles.ctrlOff]}>
            <Ionicons name={micOn ? "mic" : "mic-off"} size={26} color={colors.onSurfaceInverse} />
          </Pressable>
        )}
        {isHost && isVideo && (
          <Pressable testID="live-switch" onPress={switchCam} style={styles.ctrl}>
            <Ionicons name="camera-reverse" size={26} color={colors.onSurfaceInverse} />
          </Pressable>
        )}
        <Pressable testID="live-end" onPress={endLive} style={[styles.ctrl, styles.endBtn]}>
          <Ionicons name={isHost ? "stop" : "close"} size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Hidden remote player so audio-only lives still play sound on web (viewer) */}
      {!isVideo && !isHost && remoteStream && (
        <RTCView stream={remoteStream} streamURL={remoteStream.toURL?.()} style={styles.hidden} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F2035" },
  center: { alignItems: "center", justifyContent: "center" },
  avatarBig: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.error, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  viewerPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  titleBar: { position: "absolute", left: spacing.lg, right: spacing.lg },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg, paddingTop: spacing.lg },
  ctrl: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  ctrlOff: { backgroundColor: "rgba(255,255,255,0.4)" },
  endBtn: { backgroundColor: colors.error },
  hidden: { width: 1, height: 1, opacity: 0, position: "absolute" },
});
