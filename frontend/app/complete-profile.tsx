import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppText } from "@/src/components/ui";
import { ProfileForm } from "@/src/components/ProfileForm";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme/theme";

export default function CompleteProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="display" style={{ fontSize: 30 }}>Complétez votre profil</AppText>
        <AppText variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: spacing.xs }}>
          Ces infos aident les {user.role === "recruiter" ? "athlètes" : "recruteurs"} à vous trouver.
        </AppText>
      </View>
      <ProfileForm
        user={user}
        submitLabel="Terminer"
        onSaved={(u) => {
          setUser(u);
          router.replace("/(tabs)");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
