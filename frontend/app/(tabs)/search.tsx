import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AppText, ChipRow, Input, EmptyState, Button } from "@/src/components/ui";
import { AthleteCard, OfferCard } from "@/src/components/cards";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { SPORTS, LEVELS } from "@/src/constants/data";
import { colors, spacing, radius, fonts } from "@/src/theme/theme";

export default function Search() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isRecruiter = user?.role === "recruiter";

  const [q, setQ] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      if (sport) params.append("sport", sport);
      if (level) params.append("level", level);
      if (location) params.append("location", location);
      const qs = params.toString() ? `?${params.toString()}` : "";
      if (isRecruiter) {
        const data = await api.get(`/athletes${qs}`);
        setResults(data.athletes);
      } else {
        const data = await api.get(`/offers${qs}`);
        setResults(data.offers);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, sport, level, location, isRecruiter]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="display" style={{ fontSize: 28, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          RECHERCHE
        </AppText>
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              placeholder={isRecruiter ? "Nom de l'athlète" : "Titre de l'offre"}
              placeholderTextColor={colors.info}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={search}
              returnKeyType="search"
              style={styles.searchInput}
              testID="search-input"
            />
          </View>
        </View>
        <ChipRow items={SPORTS} selected={sport} onSelect={setSport} testIDPrefix="search-sport" />
      </View>

      {results === null ? (
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          bottomOffset={20}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="label" style={{ marginBottom: spacing.sm }}>Niveau</AppText>
          <View style={styles.levelRow}>
            {LEVELS.map((lv) => (
              <Pressable
                key={lv}
                testID={`level-${lv}`}
                onPress={() => setLevel(level === lv ? null : lv)}
                style={[styles.levelChip, level === lv && styles.levelChipActive]}
              >
                <AppText variant="body" weight="medium" color={level === lv ? colors.onBrandPrimary : colors.onSurfaceSecondary}>
                  {lv}
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <Input label="Localisation" placeholder="Ville ou pays" icon="location-outline" value={location} onChangeText={setLocation} testID="search-location" />
          </View>
          <Button title="Rechercher" full icon="search" onPress={search} testID="search-btn" />
        </KeyboardAwareScrollView>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(it) => it.user_id || it.offer_id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Pressable onPress={() => setResults(null)} style={styles.editFilters} testID="edit-filters">
              <Ionicons name="options-outline" size={16} color={colors.brandPrimary} />
              <AppText variant="body" color={colors.brandPrimary} weight="semibold" style={{ marginLeft: 6 }}>
                Modifier les filtres · {results.length} résultat(s)
              </AppText>
            </Pressable>
          }
          renderItem={({ item }) =>
            isRecruiter ? (
              <AthleteCard athlete={item} onPress={() => router.push(`/athlete/${item.user_id}`)} />
            ) : (
              <OfferCard offer={item} onPress={() => router.push(`/offer/${item.offer_id}`)} />
            )
          }
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="Aucun résultat" subtitle="Essayez d'élargir vos critères." cta="Modifier les filtres" onCta={() => setResults(null)} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    height: 52,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: 16, marginLeft: spacing.sm, height: "100%" },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  levelChip: {
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  levelChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  editFilters: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
});
