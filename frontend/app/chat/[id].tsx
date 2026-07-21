import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Modal, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Avatar, Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList>(null);
  const latestRef = useRef<string>("");
  const oldestRef = useRef<string>("");
  const autoScroll = useRef<boolean>(true);

  const [messages, setMessages] = useState<any[]>([]);
  const [other, setOther] = useState<any>(null);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const applyNew = useCallback((incoming: any[], reset: boolean) => {
    setMessages((prev) => {
      const base = reset ? [] : prev.filter((m) => !String(m.message_id).startsWith("tmp_"));
      const ids = new Set(base.map((m) => m.message_id));
      const merged = [...base, ...incoming.filter((m) => !ids.has(m.message_id))];
      merged.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      if (merged.length) {
        latestRef.current = merged[merged.length - 1].created_at;
        oldestRef.current = merged[0].created_at;
      }
      return merged;
    });
  }, []);

  const initialLoad = useCallback(async () => {
    try {
      const data = await api.get(`/conversations/${id}/messages?limit=30`);
      setOther(data.other);
      setOtherLastRead(data.other_last_read);
      setHasMore(data.has_more);
      applyNew(data.messages, true);
    } catch {} finally {
      setLoading(false);
    }
  }, [id, applyNew]);

  const pollNew = useCallback(async () => {
    if (!latestRef.current) return;
    try {
      const data = await api.get(`/conversations/${id}/messages?after=${encodeURIComponent(latestRef.current)}`);
      setOther(data.other);
      setOtherLastRead(data.other_last_read);
      if (data.messages.length) applyNew(data.messages, false);
    } catch {}
  }, [id, applyNew]);

  const loadOlder = useCallback(async () => {
    if (!oldestRef.current || loadingOlder) return;
    setLoadingOlder(true);
    autoScroll.current = false;
    try {
      const data = await api.get(`/conversations/${id}/messages?before=${encodeURIComponent(oldestRef.current)}&limit=30`);
      setHasMore(data.has_more);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.message_id));
        const older = data.messages.filter((m: any) => !ids.has(m.message_id));
        const merged = [...older, ...prev];
        if (merged.length) oldestRef.current = merged[0].created_at;
        return merged;
      });
    } catch {} finally {
      setLoadingOlder(false);
      setTimeout(() => { autoScroll.current = true; }, 400);
    }
  }, [id, loadingOlder]);

  useEffect(() => {
    initialLoad();
    const t = setInterval(pollNew, 2000);
    return () => clearInterval(t);
  }, [initialLoad, pollNew]);

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setMessages((m) => [...m, { message_id: `tmp_${Date.now()}`, sender_id: user?.user_id, text: t, created_at: new Date().toISOString() }]);
    try {
      await api.post(`/conversations/${id}/messages`, { text: t });
      pollNew();
    } catch {}
  };

  const sendImage = async (base64: string) => {
    setMessages((m) => [...m, { message_id: `tmp_${Date.now()}`, sender_id: user?.user_id, image: base64, created_at: new Date().toISOString() }]);
    try {
      await api.post(`/conversations/${id}/messages`, { image: base64 });
      pollNew();
    } catch {}
  };

  const startCall = async (media: "video" | "audio") => {
    try {
      const data = await api.post("/calls/start", { conversation_id: id, media });
      router.push(`/call/${data.room_id}?initiator=1&media=${data.media}&name=${encodeURIComponent(title)}`);
    } catch {}
  };

  const pickFromGallery = async () => {
    setAttachOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setPermDenied(true);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
    if (!res.canceled && res.assets[0]?.base64) sendImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const takePhoto = async () => {
    setAttachOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setPermDenied(true);
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (!res.canceled && res.assets[0]?.base64) sendImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const title = other?.club_name || other?.name || "Conversation";
  const lastMine = [...messages].reverse().find((m) => m.sender_id === user?.user_id && !String(m.message_id).startsWith("tmp_"));
  const seen = !!(lastMine && otherLastRead && otherLastRead >= lastMine.created_at);

  const presenceText = other?.online ? "En ligne" : (other?.last_seen ? "Hors ligne" : "");

  return (
    <View style={styles.container}>
      <View style={[styles.topbar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable
          style={styles.titleRow}
          onPress={() => other?.role === "player" && other?.user_id && router.push(`/athlete/${other.user_id}`)}
        >
          <View>
            <Avatar uri={other?.photo} name={title} size={38} />
            {other?.online && <View style={styles.onlineDot} testID="online-dot" />}
          </View>
          <View style={{ marginLeft: spacing.sm, flexShrink: 1 }}>
            <AppText variant="label" numberOfLines={1}>{title}</AppText>
            {!!presenceText && (
              <AppText variant="caption" color={other?.online ? colors.success : colors.onSurfaceTertiary} numberOfLines={1}>
                {presenceText}
              </AppText>
            )}
          </View>
        </Pressable>
        <View style={styles.callBtns}>
          <Pressable testID="chat-call-audio" onPress={() => startCall("audio")} style={styles.iconBtn}>
            <Ionicons name="call" size={19} color={colors.brandPrimary} />
          </Pressable>
          <Pressable testID="chat-call-video" onPress={() => startCall("video")} style={styles.iconBtn}>
            <Ionicons name="videocam" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView behavior="translate-with-padding" keyboardVerticalOffset={0} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => { if (autoScroll.current) listRef.current?.scrollToEnd({ animated: false }); }}
            ListHeaderComponent={
              hasMore ? (
                <Pressable testID="load-older" onPress={loadOlder} style={styles.loadOlder}>
                  {loadingOlder ? (
                    <ActivityIndicator color={colors.brandPrimary} size="small" />
                  ) : (
                    <AppText variant="caption" color={colors.brandPrimary} weight="semibold">Charger les messages précédents</AppText>
                  )}
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.user_id;
              const isLastMine = mine && lastMine && item.message_id === lastMine.message_id;
              if (item.call) {
                return (
                  <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                    <View style={styles.callCard}>
                      <View style={styles.callIcon}>
                        <Ionicons name={item.call.media === "video" ? "videocam" : "call"} size={20} color={colors.onBrandPrimary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <AppText variant="label">{item.call.media === "video" ? "Appel vidéo" : "Appel audio"}</AppText>
                        <AppText variant="caption">{mine ? "Appel lancé" : "Appel entrant"}</AppText>
                      </View>
                      {!mine && (
                        <Pressable
                          testID={`join-call-${item.message_id}`}
                          onPress={() => router.push(`/call/${item.call.room_id}?initiator=0&media=${item.call.media}&name=${encodeURIComponent(title)}`)}
                          style={styles.joinBtn}
                        >
                          <AppText variant="caption" weight="bold" color={colors.onBrandPrimary}>Rejoindre</AppText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              }
              return (
                <View>
                  <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                    {item.image ? (
                      <Pressable testID={`msg-image-${item.message_id}`} onPress={() => setPreview(item.image)}>
                        <Image source={{ uri: item.image }} style={styles.msgImage} contentFit="cover" />
                      </Pressable>
                    ) : (
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                        <AppText variant="body" color={mine ? colors.onBrandPrimary : colors.onSurface}>{item.text}</AppText>
                      </View>
                    )}
                  </View>
                  {isLastMine && (
                    <AppText variant="caption" color={colors.onSurfaceTertiary} style={styles.receipt} testID="read-receipt">
                      {seen ? "Vu" : "Envoyé"}
                    </AppText>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <AppText variant="caption">Démarrez la conversation ci-dessous.</AppText>
              </View>
            }
          />
        )}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Pressable testID="chat-attach" onPress={() => setAttachOpen(true)} style={styles.attachBtn}>
            <Ionicons name="add" size={24} color={colors.brandPrimary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Votre message…"
            placeholderTextColor={colors.info}
            style={styles.input}
            multiline
            testID="chat-input"
          />
          <Pressable testID="chat-send" onPress={sendText} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)} />
        <View style={[styles.attachSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.sheetHandle} />
          <AppText variant="displaySm" style={{ marginBottom: spacing.md }}>Envoyer une photo</AppText>
          <Pressable testID="attach-camera" onPress={takePhoto} style={styles.attachOption}>
            <Ionicons name="camera" size={22} color={colors.brandPrimary} />
            <AppText variant="label" style={{ marginLeft: spacing.md }}>Prendre une photo</AppText>
          </Pressable>
          <Pressable testID="attach-gallery" onPress={pickFromGallery} style={styles.attachOption}>
            <Ionicons name="images" size={22} color={colors.brandPrimary} />
            <AppText variant="label" style={{ marginLeft: spacing.md }}>Choisir dans la galerie</AppText>
          </Pressable>
          {permDenied && (
            <Button title="Ouvrir les réglages" variant="ghost" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.md, height: 44 }} testID="chat-open-settings" />
          )}
        </View>
      </Modal>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)} testID="close-preview">
          {preview && <Image source={{ uri: preview }} style={styles.previewImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleRow: { flexDirection: "row", alignItems: "center", flex: 1, paddingHorizontal: spacing.sm },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.surface },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  callBtns: { flexDirection: "row", gap: spacing.sm },
  callCard: { flexDirection: "row", alignItems: "center", maxWidth: "82%", backgroundColor: colors.cardSolid, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginVertical: 2 },
  callIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  joinBtn: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, marginLeft: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadOlder: { alignItems: "center", paddingVertical: spacing.md, marginBottom: spacing.sm },
  bubbleRow: { marginBottom: 2, flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.cardSolid, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgImage: { width: 200, height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  receipt: { alignSelf: "flex-end", marginBottom: spacing.sm, marginTop: 2 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: font.lg,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  attachSheet: {
    backgroundColor: colors.cardSolid,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.lg },
  attachOption: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "92%", height: "80%" },
});
