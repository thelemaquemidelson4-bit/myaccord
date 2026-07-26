import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export default function Auth() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { register, login, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecruiter = role === "recruiter";
  const isFan = role === "fan";

  const submit = async () => {
    setError(null);
    if (!email || !password || (mode === "register" && !name)) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await register(email.trim(), password, name.trim(), role || "player");
        router.replace("/complete-profile");
      } else {
        await login(email.trim(), password);
        router.replace("/");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle(role);
      router.replace("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        bottomOffset={90}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>

        <AppText variant="display" color={colors.brandPrimary} style={styles.brand}>
          Myaccord
        </AppText>

        <AppText variant="display" style={{ fontSize: 34, marginTop: spacing.lg }}>
          {mode === "register" ? "Créer un compte" : "Bon retour"}
        </AppText>
        <AppText variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
          {isRecruiter ? "Espace recruteur / club" : isFan ? "Espace supporter" : "Espace athlète"}
        </AppText>

        {mode === "register" && (
          <Input
            label={isRecruiter ? "Nom du club / recruteur" : isFan ? "Nom / pseudo" : "Nom complet"}
            placeholder={isRecruiter ? "Ex: FC Talents" : isFan ? "Ex: Alex" : "Ex: Léo Martin"}
            icon="person-outline"
            value={name}
            onChangeText={setName}
            testID="name-input"
          />
        )}
        <Input
          label="Email"
          placeholder="vous@email.com"
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="email-input"
        />
        <Input
          label="Mot de passe"
          placeholder="••••••••"
          icon="lock-closed-outline"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="password-input"
        />

        {error && (
          <AppText variant="caption" color={colors.error} style={{ marginBottom: spacing.md }} testID="auth-error">
            {error}
          </AppText>
        )}

        <View style={styles.divider}>
          <View style={styles.line} />
          <AppText variant="caption" style={{ marginHorizontal: spacing.md }}>OU</AppText>
          <View style={styles.line} />
        </View>

        <Button
          title="Continuer avec Google"
          variant="ghost"
          icon="logo-google"
          full
          loading={googleLoading}
          onPress={google}
          testID="google-btn"
        />

        <Pressable
          onPress={() => setMode(mode === "register" ? "login" : "register")}
          style={{ marginTop: spacing.xl, alignSelf: "center" }}
          testID="toggle-mode"
        >
          <AppText variant="body" color={colors.onSurfaceTertiary}>
            {mode === "register" ? "Déjà un compte ? " : "Pas de compte ? "}
            <AppText variant="body" color={colors.brandPrimary} weight="semibold">
              {mode === "register" ? "Se connecter" : "S'inscrire"}
            </AppText>
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title={mode === "register" ? "S'inscrire" : "Se connecter"}
            full
            loading={loading}
            onPress={submit}
            testID="submit-btn"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  brand: { fontSize: 40, marginTop: spacing.lg, alignSelf: "flex-start" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.divider },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
