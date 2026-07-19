import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Badge, Avatar } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { SPORT_ICONS } from "@/src/constants/data";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export default function OfferDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [offer, setOffer] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const isOwner = offer && user?.user_id === offer.recruiter_id;

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/offers/${id}`);
      setOffer(data.offer);
      if (user?.user_id === data.offer.recruiter_id) {
        const apps = await api.get(`/offers/${id}/applications`);
        setApplications(apps.applications);
      } else if (user?.role === "player") {
        const mine = await api.get("/applications/mine");
        setApplied(mine.applications.some((a: any) => a.offer_id === id));
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [id, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const apply = async () => {
    setApplying(true);
    try {
      const data = await api.post("/applications", { offer_id: id });
      setApplied(true);
      router.push(`/chat/${data.conversation_id}`);
    } catch (e: any) {
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!offer) return <View style={styles.center}><AppText variant="body">Offre introuvable</AppText></View>;

  const initials = (offer.club_name || offer.recruiter_name || "?").split(" ").slice(0, 3).map((s: string) => s[0]).join("").toUpperCase();

  return (
    <View style={styles.container}>
      <View style={[styles.topbar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="offer-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="label">Détail de l&apos;offre</AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.clubRow}>
          {offer.recruiter_photo ? (
            <Avatar uri={offer.recruiter_photo} size={56} />
          ) : (
            <View style={styles.clubBadge}><AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 18, color: colors.onSurfaceTertiary }}>{initials}</AppText></View>
          )}
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <AppText variant="caption">{offer.club_name || offer.recruiter_name}</AppText>
            <View style={styles.sportRow}>
              <Ionicons name={(SPORT_ICONS[offer.sport] as any) || "football"} size={14} color={colors.brandPrimary} />
              <AppText variant="caption" color={colors.brandPrimary} weight="semibold" style={{ marginLeft: 4 }}>{offer.sport}</AppText>
            </View>
          </View>
        </View>

        <AppText variant="display" style={{ fontSize: font["3xl"], marginTop: spacing.lg }}>{offer.title}</AppText>

        <View style={styles.tagRow}>
          {offer.position && <Badge text={offer.position} />}
          {offer.level && <Badge text={offer.level} color={colors.surfaceTertiary} textColor={colors.onSurfaceSecondary} />}
          {offer.location && <Badge text={offer.location} color={colors.surfaceTertiary} textColor={colors.onSurfaceSecondary} />}
        </View>

        <AppText variant="displaySm" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Description</AppText>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>{offer.description}</AppText>

        {isOwner && (
          <>
            <AppText variant="displaySm" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Candidatures ({applications.length})</AppText>
            {applications.length === 0 ? (
              <AppText variant="caption">Aucune candidature pour le moment.</AppText>
            ) : (
              applications.map((a) => (
                <Pressable key={a.application_id} testID={`app-${a.application_id}`} onPress={() => router.push(`/athlete/${a.athlete_id}`)} style={styles.appRow}>
                  <Avatar uri={a.athlete?.photo} name={a.athlete_name} size={44} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <AppText variant="label">{a.athlete_name}</AppText>
                    <AppText variant="caption" style={{ marginTop: 2 }}>{a.athlete?.position || a.athlete?.sport || "Athlète"}</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {user?.role === "player" && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title={applied ? "Candidature envoyée" : "Postuler"}
            icon={applied ? "checkmark-circle" : "send"}
            full
            disabled={applied}
            loading={applying}
            onPress={apply}
            testID="apply-btn"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  clubRow: { flexDirection: "row", alignItems: "center" },
  clubBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  sportRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  tagRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  appRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
});
