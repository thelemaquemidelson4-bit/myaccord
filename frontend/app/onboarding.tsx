import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme/theme";

const ATHLETE_BG = "https://images.pexels.com/photos/35005203/pexels-photo-35005203.jpeg";
const RECRUITER_BG = "https://images.pexels.com/photos/32101180/pexels-photo-32101180.jpeg";
const FAN_BG = "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg";

const ROLES = [
  { key: "player", title: "Athlète", subtitle: "Profil, stats et clubs.", image: ATHLETE_BG, icon: "walk", testID: "role-player" },
  { key: "recruiter", title: "Recruteur", subtitle: "Talents et offres.", image: RECRUITER_BG, icon: "briefcase", testID: "role-recruiter" },
  { key: "fan", title: "Supporter", subtitle: "Suivez et regardez les directs.", image: FAN_BG, icon: "heart", testID: "role-fan" },
] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [role, setRole] = useState<"player" | "recruiter" | "fan" | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <AppText variant="display" color={colors.brandPrimary} style={styles.brandName}>
          Myaccord
        </AppText>
        <AppText variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: 2 }}>
          La plateforme de recrutement sportif
        </AppText>
      </View>

      <AppText variant="label" style={styles.pick}>Je suis…</AppText>

      <View style={styles.list}>
        {ROLES.map((r) => {
          const selected = role === r.key;
          return (
            <Pressable
              key={r.key}
              testID={r.testID}
              onPress={() => setRole(r.key)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <Image source={{ uri: r.image }} style={styles.thumb} contentFit="cover" />
              <View style={styles.rowText}>
                <AppText variant="displaySm" numberOfLines={1}>{r.title}</AppText>
                <AppText variant="caption" numberOfLines={1}>{r.subtitle}</AppText>
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected && <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button
          title="Continuer"
          full
          disabled={!role}
          testID="onboarding-continue"
          onPress={() => router.push({ pathname: "/auth", params: { role: role! } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  header: { alignItems: "center", marginBottom: spacing.xl },
  brandName: { fontSize: 34, letterSpacing: 0.3 },
  pick: { marginBottom: spacing.md },
  list: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  rowText: { flex: 1, marginLeft: spacing.md },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  radioOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  footer: { marginTop: "auto", paddingBottom: spacing.xl, paddingTop: spacing.md },
});
