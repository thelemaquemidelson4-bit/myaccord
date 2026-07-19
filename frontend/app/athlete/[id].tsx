import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Badge } from "@/src/components/ui";
import { api, User } from "@/src/api/client";
import { FALLBACK_HERO } from "@/src/constants/data";
import { colors, spacing, radius, font } from "@/src/theme/theme";

export default function AthleteDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [athlete, setAthlete] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/athletes/${id}`);
        setAthlete(data.athlete);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const contact = async () => {
    setContacting(true);
    try {
      const data = await api.post("/conversations", { target_user_id: id });
      router.push(`/chat/${data.conversation_id}`);
    } catch {} finally {
      setContacting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!athlete) return <View style={styles.center}><AppText variant="body">Profil introuvable</AppText></View>;

  const hero = athlete.photo || FALLBACK_HERO;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(15,17,21,0.5)", "transparent", "rgba(15,17,21,0.95)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable testID="athlete-back" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.heroBottom}>
            <AppText variant="display" style={{ fontSize: font["4xl"] }} numberOfLines={1}>{athlete.name}</AppText>
            <View style={styles.tagRow}>
              {athlete.sport && <Badge text={athlete.sport} color={colors.brandPrimary} textColor={colors.onBrandPrimary} />}
              {athlete.position && <Badge text={athlete.position} />}
              {athlete.level && <Badge text={athlete.level} color={colors.surfaceTertiary} textColor={colors.onSurfaceSecondary} />}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsGrid}>
            <Stat value={athlete.age ? `${athlete.age}` : "—"} unit="ans" label="Âge" />
            <Stat value={athlete.height ? `${athlete.height}` : "—"} unit="cm" label="Taille" />
            <Stat value={athlete.weight ? `${athlete.weight}` : "—"} unit="kg" label="Poids" />
          </View>

          {athlete.location ? (
            <View style={styles.locRow}>
              <Ionicons name="location" size={16} color={colors.brandPrimary} />
              <AppText variant="body" style={{ marginLeft: spacing.sm }}>{athlete.location}</AppText>
            </View>
          ) : null}

          {athlete.ai_summary ? (
            <View style={styles.aiCard}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="sparkles" size={16} color={colors.warning} />
                <AppText variant="label" style={{ marginLeft: spacing.sm }}>Analyse IA</AppText>
              </View>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm, lineHeight: 21 }}>{athlete.ai_summary}</AppText>
            </View>
          ) : null}

          {athlete.bio ? (
            <>
              <AppText variant="displaySm" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>À propos</AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ lineHeight: 21 }}>{athlete.bio}</AppText>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Contacter" icon="chatbubble-ellipses" full loading={contacting} onPress={contact} testID="contact-btn" />
      </View>
    </View>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <AppText variant="display" color={colors.brandPrimary} style={{ fontSize: font["2xl"] }}>{value}</AppText>
      <AppText variant="caption">{unit}</AppText>
      <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ marginTop: 2 }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { height: 420, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", paddingHorizontal: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(37,41,50,0.85)", alignItems: "center", justifyContent: "center" },
  heroBottom: { padding: spacing.lg },
  tagRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  locRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  aiCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
});
