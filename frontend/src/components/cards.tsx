import React from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Avatar, Badge } from "@/src/components/ui";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";
import { SPORT_ICONS, FALLBACK_HERO } from "@/src/constants/data";
import { User } from "@/src/api/client";

const { width } = Dimensions.get("window");

export function AthleteCard({ athlete, onPress }: { athlete: User & { ai_reason?: string }; onPress: () => void }) {
  const img = athlete.photo || FALLBACK_HERO;
  return (
    <Pressable testID={`athlete-card-${athlete.user_id}`} onPress={onPress} style={styles.athleteCard}>
      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(15,17,21,0.2)", "rgba(15,17,21,0.95)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.athleteTop}>
        {athlete.sport && (
          <View style={styles.sportTag}>
            <Ionicons name={(SPORT_ICONS[athlete.sport] as any) || "football"} size={13} color={colors.onSurface} />
            <AppText variant="caption" color={colors.onSurface} weight="semibold" style={{ marginLeft: 4 }}>
              {athlete.sport}
            </AppText>
          </View>
        )}
        {athlete.level && <Badge text={athlete.level} />}
      </View>

      <View style={styles.athleteBottom}>
        {athlete.ai_reason && (
          <View style={styles.aiReason}>
            <Ionicons name="sparkles" size={12} color={colors.warning} />
            <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginLeft: 6, flex: 1 }} numberOfLines={2}>
              {athlete.ai_reason}
            </AppText>
          </View>
        )}
        <AppText variant="display" style={{ fontSize: font["3xl"] }} numberOfLines={1}>
          {athlete.name}
        </AppText>
        <View style={styles.metaRow}>
          {athlete.position && <MetaChip label={athlete.position} />}
          {athlete.age ? <MetaChip label={`${athlete.age} ans`} /> : null}
          {athlete.location ? <MetaChip label={athlete.location} icon="location" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function MetaChip({ label, icon }: { label: string; icon?: any }) {
  return (
    <View style={styles.metaChip}>
      {icon && <Ionicons name={icon} size={11} color={colors.onSurfaceTertiary} style={{ marginRight: 3 }} />}
      <AppText variant="caption" color={colors.onSurfaceSecondary} weight="medium">{label}</AppText>
    </View>
  );
}

export function OfferCard({ offer, onPress }: { offer: any; onPress: () => void }) {
  const initials = (offer.club_name || offer.recruiter_name || "?")
    .split(" ").slice(0, 3).map((s: string) => s[0]).join("").toUpperCase();
  return (
    <Pressable testID={`offer-card-${offer.offer_id}`} onPress={onPress} style={styles.offerCard}>
      <View style={styles.offerHeader}>
        {offer.recruiter_photo ? (
          <Avatar uri={offer.recruiter_photo} size={44} />
        ) : (
          <View style={styles.clubBadge}>
            <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.onSurfaceTertiary }}>{initials}</AppText>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <AppText variant="label" numberOfLines={1}>{offer.title}</AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>{offer.club_name || offer.recruiter_name}</AppText>
        </View>
        <View style={styles.sportPill}>
          <Ionicons name={(SPORT_ICONS[offer.sport] as any) || "football"} size={14} color={colors.brandPrimary} />
        </View>
      </View>
      <AppText variant="body" color={colors.onSurfaceTertiary} numberOfLines={2} style={{ marginTop: spacing.md }}>
        {offer.description}
      </AppText>
      <View style={styles.offerMeta}>
        {offer.sport && <MetaChip label={offer.sport} />}
        {offer.position ? <MetaChip label={offer.position} /> : null}
        {offer.level ? <MetaChip label={offer.level} /> : null}
        {offer.location ? <MetaChip label={offer.location} icon="location" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  athleteCard: {
    width: width - spacing.lg * 2,
    height: 440,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "space-between",
  },
  athleteTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.md,
  },
  sportTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37,41,50,0.85)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  athleteBottom: { padding: spacing.lg },
  aiReason: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37,41,50,0.9)",
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  offerCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  offerHeader: { flexDirection: "row", alignItems: "center" },
  clubBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  sportPill: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  offerMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
});
