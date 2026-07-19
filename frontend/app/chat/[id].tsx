import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Avatar } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [other, setOther] = useState<any>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/conversations/${id}/messages`);
      setMessages(data.messages);
      setOther(data.other);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const optimistic = { message_id: `tmp_${Date.now()}`, sender_id: user?.user_id, text: t, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      await api.post(`/conversations/${id}/messages`, { text: t });
      load();
    } catch {}
  };

  const title = other?.club_name || other?.name || "Conversation";

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
          <Avatar uri={other?.photo} name={title} size={36} />
          <AppText variant="label" style={{ marginLeft: spacing.sm }} numberOfLines={1}>{title}</AppText>
        </Pressable>
        <View style={{ width: 40 }} />
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
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.user_id;
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <AppText variant="body" color={mine ? colors.onBrandPrimary : colors.onSurface}>{item.text}</AppText>
                  </View>
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
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Votre message…"
            placeholderTextColor={colors.info}
            style={styles.input}
            multiline
            testID="chat-input"
          />
          <Pressable testID="chat-send" onPress={send} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleRow: { flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.cardSolid, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
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
});
