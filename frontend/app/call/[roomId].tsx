import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme/theme";
import { getToken, wsUrl } from "@/src/api/client";
import { ICE_SERVERS } from "@/src/webrtc/config";
import {
  webrtcAvailable,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from "@/src/webrtc/rtc";

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roomId, media, initiator, name } = useLocalSearchParams<{
    roomId: string; media?: string; initiator?: string; name?: string;
  }>();
  const isVideo = media !== "audio";
  const isInitiator = initiator === "1";

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<any>(null);
  const peerIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<any>(null);
  const offerSentRef = useRef(false);
  const pendingCandidates = useRef<any[]>([]);

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);

  const cleanup = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    try { localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    wsRef.current = null;
    pcRef.current = null;
  }, []);

  const hangUp = useCallback(() => {
    cleanup();
    router.back();
  }, [cleanup, router]);

  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    localStreamRef.current?.getTracks?.().forEach((t: any) => pc.addTrack(t, localStreamRef.current));
    pc.ontrack = (e: any) => {
      if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (e: any) => {
      if (e.candidate && peerIdRef.current) {
        wsRef.current?.send(JSON.stringify({ type: "candidate", candidate: e.candidate, to: peerIdRef.current }));
      }
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") setStatus("connected");
      if (st === "failed" || st === "closed") setStatus("error");
    };
    return pc;
  }, []);

  const makeOffer = useCallback(async () => {
    if (offerSentRef.current || !peerIdRef.current) return;
    offerSentRef.current = true;
    const pc = ensurePeer();
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideo });
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: "offer", sdp: pc.localDescription, to: peerIdRef.current }));
  }, [ensurePeer, isVideo]);

  const handleSignal = useCallback(async (msg: any) => {
    const pc = pcRef.current;
    switch (msg.type) {
      case "peers": {
        if (isInitiator && msg.peers?.length) {
          peerIdRef.current = msg.peers[0].user_id;
          makeOffer();
        }
        break;
      }
      case "peer-joined": {
        if (isInitiator && !peerIdRef.current) {
          peerIdRef.current = msg.user_id;
          makeOffer();
        }
        break;
      }
      case "offer": {
        peerIdRef.current = msg.from;
        const peer = ensurePeer();
        await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of pendingCandidates.current) { try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        pendingCandidates.current = [];
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: "answer", sdp: peer.localDescription, to: msg.from }));
        break;
      }
      case "answer": {
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        break;
      }
      case "candidate": {
        if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
        else pendingCandidates.current.push(msg.candidate);
        break;
      }
      case "peer-left": {
        setStatus("error");
        setErrorMsg("Votre correspondant a quitté l'appel.");
        break;
      }
    }
  }, [ensurePeer, isInitiator, makeOffer]);

  useEffect(() => {
    if (!webrtcAvailable) { setStatus("error"); return; }
    let cancelled = false;
    (async () => {
      try {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: "user" } : false });
        if (cancelled) { stream.getTracks().forEach((t: any) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const token = await getToken();
        const ws = new WebSocket(wsUrl(`/ws/signal/${roomId}`, token));
        wsRef.current = ws;
        ws.onmessage = (ev) => { try { handleSignal(JSON.parse(ev.data)); } catch {} };
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
  const toggleCam = () => {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => { t.enabled = next; });
    setCamOn(next);
  };
  const switchCam = () => {
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => { try { t._switchCamera(); } catch {} });
  };

  if (!webrtcAvailable) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="videocam-off" size={48} color={colors.onSurfaceInverse} />
        <AppText variant="displaySm" color={colors.onSurfaceInverse} center style={{ marginTop: spacing.lg }}>
          Appels non disponibles ici
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.7)" center style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
          Les appels audio/vidéo nécessitent un build natif (iOS/Android). Ils ne fonctionnent pas dans Expo Go ni sur l'aperçu web. Publiez l'app puis générez un build pour les utiliser.
        </AppText>
        <Button title="Retour" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.xl }} testID="call-back-web" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isVideo && remoteStream ? (
        <RTCView stream={remoteStream} streamURL={remoteStream.toURL?.()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.audioBg, styles.center]}>
          <View style={styles.avatarBig}>
            <Ionicons name="person" size={64} color={colors.onSurfaceInverse} />
          </View>
          <AppText variant="display" color={colors.onSurfaceInverse} style={{ marginTop: spacing.lg }}>
            {name || "Appel"}
          </AppText>
        </View>
      )}

      {isVideo && camOn && localStream && (
        <View style={[styles.pip, { top: insets.top + spacing.md }]}>
          <RTCView stream={localStream} streamURL={localStream.toURL?.()} style={styles.pipVideo} objectFit="cover" zOrder={1} mirror />
        </View>
      )}

      <View style={[styles.topInfo, { top: insets.top + spacing.md }]}>
        <AppText variant="label" color={colors.onSurfaceInverse}>{name || "Appel"}</AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.75)">
          {status === "connected" ? "Connecté" : status === "error" ? "Terminé" : "Connexion…"}
        </AppText>
      </View>

      {status === "connecting" && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.onSurfaceInverse} size="large" />
        </View>
      )}

      {status === "error" && errorMsg && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText variant="body" color={colors.onSurfaceInverse} center style={{ paddingHorizontal: spacing.xl }}>
            {errorMsg}
          </AppText>
          {errorMsg.includes("réglages") && (
            <Button title="Ouvrir les réglages" variant="ghost" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.lg }} testID="call-settings" />
          )}
        </View>
      )}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable testID="call-mic" onPress={toggleMic} style={[styles.ctrl, !micOn && styles.ctrlOff]}>
          <Ionicons name={micOn ? "mic" : "mic-off"} size={26} color={colors.onSurfaceInverse} />
        </Pressable>
        {isVideo && (
          <Pressable testID="call-cam" onPress={toggleCam} style={[styles.ctrl, !camOn && styles.ctrlOff]}>
            <Ionicons name={camOn ? "videocam" : "videocam-off"} size={26} color={colors.onSurfaceInverse} />
          </Pressable>
        )}
        {isVideo && (
          <Pressable testID="call-switch" onPress={switchCam} style={styles.ctrl}>
            <Ionicons name="camera-reverse" size={26} color={colors.onSurfaceInverse} />
          </Pressable>
        )}
        <Pressable testID="call-hangup" onPress={hangUp} style={[styles.ctrl, styles.hangup]}>
          <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
      </View>

      {/* Hidden remote player so audio-only calls still play sound on web */}
      {!isVideo && remoteStream && (
        <RTCView stream={remoteStream} streamURL={remoteStream.toURL?.()} style={styles.hidden} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F2035" },
  center: { alignItems: "center", justifyContent: "center" },
  audioBg: { backgroundColor: "#0F2035" },
  avatarBig: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  pip: { position: "absolute", right: spacing.md, width: 108, height: 156, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  pipVideo: { width: "100%", height: "100%" },
  topInfo: { position: "absolute", left: spacing.lg, alignItems: "flex-start" },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg, paddingTop: spacing.lg },
  ctrl: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  ctrlOff: { backgroundColor: "rgba(255,255,255,0.4)" },
  hidden: { width: 1, height: 1, opacity: 0, position: "absolute" },
  hangup: { backgroundColor: colors.error },
});
