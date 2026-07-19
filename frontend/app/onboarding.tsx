import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

const { height } = Dimensions.get("window");

const ATHLETE_BG = "https://images.pexels.com/photos/35005203/pexels-photo-35005203.jpeg";
const RECRUITER_BG = "https://images.pexels.com/photos/32101180/pexels-photo-32101180.jpeg";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [role, setRole] = useState<"player" | "recruiter" | null>(null);

  const cardHeight = (height - insets.top - insets.bottom - 180) / 2;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require("../assets/images/intake-logo.png")}
            style={styles.logoImg}
            contentFit="contain"
          />
          <AppText variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: spacing.sm }}>
            La plateforme de recrutement sportif
          </AppText>
        </View>

        <RoleCard
          testID="role-player"
          title="Je suis Athlète"
          subtitle="Créez votre profil, montrez vos stats et trouvez un club."
          image={ATHLETE_BG}
          selected={role === "player"}
          onPress={() => setRole("player")}
          height={cardHeight}
        />
        <RoleCard
          testID="role-recruiter"
          title="Je suis Recruteur"
          subtitle="Découvrez des talents et publiez vos offres."
          image={RECRUITER_BG}
          selected={role === "recruiter"}
          onPress={() => setRole("recruiter")}
          height={cardHeight}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
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

function RoleCard({ title, subtitle, image, selected, onPress, height, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.card, { height }, selected && styles.cardSelected]}>
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(15,17,21,0.5)", "rgba(15,17,21,0.95)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />
        </View>
      )}
      <View style={styles.cardContent}>
        <AppText variant="display" color="#FFFFFF" style={{ fontSize: font["3xl"] }}>{title}</AppText>
        <AppText variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.xs }}>
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl, alignItems: "flex-start" },
  logo: { fontSize: 40, letterSpacing: 1 },
  logoImg: { width: 96, height: 96, borderRadius: radius.lg },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "flex-end",
  },
  cardSelected: { borderColor: colors.brandPrimary },
  cardContent: { padding: spacing.lg },
  check: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
