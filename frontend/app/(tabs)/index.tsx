import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, ChipRow, EmptyState, Button } from "@/src/components/ui";
import { AthleteCard, OfferCard } from "@/src/components/cards";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { SPORTS } from "@/src/constants/data";
import { colors, spacing, radius, fonts } from "@/src/theme/theme";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isRecruiter = user?.role === "recruiter";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sport, setSport] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
      if (isRecruiter) {
        const data = await api.get(`/athletes${q}`);
        setItems(data.athletes);
      } else {
        const data = await api.get(`/offers${q}`);
        setItems(data.offers);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sport, isRecruiter]);

  useFocusEffect(useCallback(() => { setAiMode(false); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const runAi = async () => {
    setAiLoading(true);
    setAiMode(true);
    try {
      const data = await api.post("/ai/match-suggestions", { sport });
      setItems(data.suggestions);
    } catch {
      setItems([]);
    } finally {
      setAiLoading(false);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandBar}>
          <Image
            source={require("../../assets/images/myaccord-logo.png")}
            style={styles.brandLogo}
            contentFit="contain"
          />
          {isRecruiter && (
            <Pressable testID="ai-suggest-btn" onPress={aiMode ? () => { setAiMode(false); load(); } : runAi} style={[styles.aiBtn, aiMode && styles.aiBtnActive]}>
              <Ionicons name="sparkles" size={16} color={aiMode ? colors.onBrandPrimary : colors.warning} />
              <AppText variant="caption" weight="semibold" color={aiMode ? colors.onBrandPrimary : colors.onSurface} style={{ marginLeft: 5 }}>
                IA
              </AppText>
            </Pressable>
          )}
        </View>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={colors.onSurfaceTertiary} numberOfLines={1}>
              {isRecruiter ? "Découvrez des talents" : "Offres pour vous"}
            </AppText>
            <AppText variant="display" style={{ fontSize: 28 }}>
              {isRecruiter ? "TALENTS" : "OFFRES"}
            </AppText>
          </View>
        </View>
        <ChipRow items={SPORTS} selected={sport} onSelect={(v) => { setSport(v); }} testIDPrefix="home-sport" />
      </View>

      {loading || aiLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          {aiLoading && <AppText variant="caption" style={{ marginTop: spacing.md }}>Analyse IA en cours…</AppText>}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.user_id || it.offer_id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) =>
            isRecruiter ? (
              <AthleteCard athlete={item} onPress={() => router.push(`/athlete/${item.user_id}`)} />
            ) : (
              <OfferCard offer={item} onPress={() => router.push(`/offer/${item.offer_id}`)} />
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon={isRecruiter ? "people-outline" : "clipboard-outline"}
              title={isRecruiter ? "Aucun athlète trouvé" : "Aucune offre trouvée"}
              subtitle="Modifiez les filtres ou revenez plus tard."
              cta={sport ? "Réinitialiser" : undefined}
              onCta={() => setSport(null)}
            />
          }
        />
      )}

      {isRecruiter && (
        <Pressable testID="fab-create-offer" onPress={() => router.push("/create-offer")} style={[styles.fab, { bottom: insets.bottom + 76 }]}>
          <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  brandLogo: { width: 132, height: 44 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  aiBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
