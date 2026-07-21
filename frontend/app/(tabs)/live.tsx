import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Avatar, EmptyState } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export default function LiveTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [lives, setLives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<"video" | "audio">("video");
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/lives");
      setLives(data.lives);
    } catch {
      setLives([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const goLive = async () => {
    setStarting(true);
    try {
      const data = await api.post("/lives/start", { title: title.trim(), media });
      const lv = data.live;
      setStartOpen(false);
      setTitle("");
      router.push(`/live/${lv.room_id}?role=host&media=${lv.media}&title=${encodeURIComponent(lv.title)}`);
    } catch {} finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="caption" color={colors.onSurfaceTertiary}>Diffusions en cours</AppText>
        <AppText variant="display" style={{ fontSize: 28 }}>DIRECTS</AppText>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <FlatList
          data={lives}
          keyExtractor={(it) => it.live_id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`live-item-${item.live_id}`}
              onPress={() => router.push(`/live/${item.room_id}?role=viewer&media=${item.media}&title=${encodeURIComponent(item.title)}`)}
              style={styles.card}
            >
              <View style={styles.thumb}>
                <Ionicons name={item.media === "audio" ? "mic" : "videocam"} size={26} color={colors.onBrandPrimary} />
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <AppText variant="caption" weight="bold" color="#FFFFFF" style={{ fontSize: 10 }}>LIVE</AppText>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText variant="label" numberOfLines={1}>{item.title}</AppText>
                <View style={styles.hostRow}>
                  <Avatar uri={item.host_photo} name={item.host_name} size={22} />
                  <AppText variant="caption" style={{ marginLeft: 6 }} numberOfLines={1}>{item.host_name}</AppText>
                </View>
                <View style={styles.viewRow}>
                  <Ionicons name="eye-outline" size={13} color={colors.onSurfaceTertiary} />
                  <AppText variant="caption" style={{ marginLeft: 4 }}>{item.viewers} spectateur{item.viewers > 1 ? "s" : ""}</AppText>
                </View>
              </View>
              <Ionicons name="play-circle" size={30} color={colors.brandPrimary} />
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="radio-outline"
              title="Aucun direct pour le moment"
              subtitle="Lancez le vôtre et partagez vos moments sportifs en temps réel."
            />
          }
        />
      )}

      <Pressable testID="fab-go-live" onPress={() => setStartOpen(true)} style={[styles.fab, { bottom: insets.bottom + 76 }]}>
        <Ionicons name="radio" size={24} color={colors.onBrandPrimary} />
        <AppText variant="label" color={colors.onBrandPrimary} style={{ marginLeft: 8 }}>En direct</AppText>
      </Pressable>

      <Modal visible={startOpen} transparent animationType="fade" onRequestClose={() => setStartOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setStartOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.sheetHandle} />
          <AppText variant="displaySm" style={{ marginBottom: spacing.md }}>Passer en direct</AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titre du direct (ex: Entraînement du jour)"
            placeholderTextColor={colors.info}
            style={styles.input}
            testID="live-title-input"
          />
          <View style={styles.mediaRow}>
            <Pressable testID="live-media-video" onPress={() => setMedia("video")} style={[styles.mediaOpt, media === "video" && styles.mediaOptActive]}>
              <Ionicons name="videocam" size={18} color={media === "video" ? colors.onBrandPrimary : colors.onSurface} />
              <AppText variant="label" color={media === "video" ? colors.onBrandPrimary : colors.onSurface} style={{ marginLeft: 6 }}>Vidéo</AppText>
            </Pressable>
            <Pressable testID="live-media-audio" onPress={() => setMedia("audio")} style={[styles.mediaOpt, media === "audio" && styles.mediaOptActive]}>
              <Ionicons name="mic" size={18} color={media === "audio" ? colors.onBrandPrimary : colors.onSurface} />
              <AppText variant="label" color={media === "audio" ? colors.onBrandPrimary : colors.onSurface} style={{ marginLeft: 6 }}>Audio</AppText>
            </Pressable>
          </View>
          <Button title="Démarrer le direct" full loading={starting} onPress={goLive} testID="live-start-confirm" style={{ marginTop: spacing.lg }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.cardSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  liveBadge: { position: "absolute", top: 4, left: 4, flexDirection: "row", alignItems: "center", backgroundColor: colors.error, paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.pill, gap: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  hostRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  viewRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", height: 52, paddingHorizontal: spacing.lg, borderRadius: 26, backgroundColor: colors.error, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.cardSolid, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.lg },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, height: 52, color: colors.onSurface, fontFamily: fonts.body, fontSize: font.lg },
  mediaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  mediaOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  mediaOptActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
});
