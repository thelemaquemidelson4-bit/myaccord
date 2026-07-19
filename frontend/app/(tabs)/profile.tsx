import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Badge } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { FALLBACK_HERO } from "@/src/constants/data";
import { colors, spacing, radius, font } from "@/src/theme/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const isRecruiter = user?.role === "recruiter";

  const [aiLoading, setAiLoading] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me.user);
      if (me.user.role === "recruiter") {
        const o = await api.get("/offers/mine");
        setOffers(o.offers);
      } else {
        const a = await api.get("/applications/mine");
        setApps(a.applications);
      }
    } catch {}
  }, [setUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generateAi = async () => {
    setAiLoading(true);
    try {
      const data = await api.post("/ai/profile-summary", {});
      setUser({ ...(user as any), ai_summary: data.summary });
    } catch {} finally {
      setAiLoading(false);
    }
  };

  if (!user) return null;
  const hero = user.photo || (isRecruiter ? undefined : FALLBACK_HERO);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {hero ? (
            <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" }]}>
              <AppText variant="display" color="rgba(255,255,255,0.55)" style={{ fontSize: 48 }}>
                {(user.club_name || user.name || "?").slice(0, 3).toUpperCase()}
              </AppText>
            </View>
          )}
          <LinearGradient colors={["rgba(15,17,21,0.3)", "transparent", "rgba(15,17,21,0.95)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable testID="logout-btn" onPress={logout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.heroBottom}>
            <AppText variant="display" color="#FFFFFF" style={{ fontSize: font["4xl"] }} numberOfLines={1}>
              {isRecruiter ? (user.club_name || user.name) : user.name}
            </AppText>
            <View style={styles.tagRow}>
              {user.sport && <Badge text={user.sport} color={colors.brandPrimary} textColor={colors.onBrandPrimary} />}
              {user.position && <Badge text={user.position} />}
              {user.level && <Badge text={user.level} color={colors.surfaceTertiary} textColor={colors.onSurfaceSecondary} />}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Button title="Modifier le profil" icon="create-outline" variant="secondary" full onPress={() => router.push("/edit-profile")} testID="edit-profile-btn" />

          {!isRecruiter && (
            <>
              <SectionTitle title="Caractéristiques" />
              <View style={styles.statsGrid}>
                <Stat label="Âge" value={user.age ? `${user.age}` : "—"} unit="ans" />
                <Stat label="Taille" value={user.height ? `${user.height}` : "—"} unit="cm" />
                <Stat label="Poids" value={user.weight ? `${user.weight}` : "—"} unit="kg" />
              </View>
            </>
          )}

          {!isRecruiter && (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={16} color={colors.warning} />
                <AppText variant="label" style={{ marginLeft: spacing.sm }}>Résumé IA</AppText>
              </View>
              {user.ai_summary ? (
                <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm, lineHeight: 21 }}>
                  {user.ai_summary}
                </AppText>
              ) : (
                <AppText variant="caption" style={{ marginTop: spacing.sm }}>
                  Générez une présentation professionnelle de votre profil grâce à l&apos;IA.
                </AppText>
              )}
              <Button
                title={user.ai_summary ? "Régénérer" : "Générer avec l'IA"}
                variant="ghost"
                loading={aiLoading}
                onPress={generateAi}
                style={{ marginTop: spacing.md, height: 44 }}
                testID="ai-summary-btn"
              />
            </View>
          )}

          {user.bio ? (
            <>
              <SectionTitle title="À propos" />
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ lineHeight: 21 }}>{user.bio}</AppText>
            </>
          ) : null}

          {isRecruiter ? (
            <>
              <SectionTitle title={`Mes offres (${offers.length})`} />
              {offers.length === 0 ? (
                <AppText variant="caption">Aucune offre publiée. Utilisez le bouton + sur l&apos;accueil.</AppText>
              ) : (
                offers.map((o) => (
                  <Pressable key={o.offer_id} testID={`my-offer-${o.offer_id}`} onPress={() => router.push(`/offer/${o.offer_id}`)} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" numberOfLines={1}>{o.title}</AppText>
                      <AppText variant="caption" style={{ marginTop: 2 }}>{o.sport}{o.location ? ` · ${o.location}` : ""}</AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
                  </Pressable>
                ))
              )}
            </>
          ) : (
            <>
              <SectionTitle title={`Mes candidatures (${apps.length})`} />
              {apps.length === 0 ? (
                <AppText variant="caption">Aucune candidature pour le moment.</AppText>
              ) : (
                apps.map((a) => {
                  const meta = a.status === "accepted"
                    ? { label: "Acceptée", color: "#D6F5E3", text: "#0B7A43" }
                    : a.status === "rejected"
                    ? { label: "Refusée", color: "#FADCDC", text: "#B02B2B" }
                    : { label: "En attente", color: colors.surfaceTertiary, text: colors.onSurfaceSecondary };
                  return (
                    <View key={a.application_id} style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" numberOfLines={1}>{a.offer_title}</AppText>
                        <AppText variant="caption" style={{ marginTop: 2 }}>Statut de la candidature</AppText>
                      </View>
                      <Badge text={meta.label} color={meta.color} textColor={meta.text} />
                    </View>
                  );
                })
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <AppText variant="displaySm" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>{title}</AppText>;
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
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
  hero: { height: 360, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(37,41,50,0.8)",
    alignItems: "center", justifyContent: "center",
  },
  heroBottom: { padding: spacing.lg },
  tagRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
  },
  aiCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  aiHeader: { flexDirection: "row", alignItems: "center" },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
