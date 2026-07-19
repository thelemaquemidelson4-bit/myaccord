import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { AppText, Avatar, EmptyState } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme/theme";

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/conversations");
      setConvs(data.conversations);
    } catch {
      setConvs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="display" style={{ fontSize: 28 }}>MESSAGES</AppText>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={(c) => c.conversation_id}
          contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
          renderItem={({ item }) => {
            const other = item.other;
            const title = other?.club_name || other?.name || "Utilisateur";
            return (
              <Pressable
                testID={`conv-${item.conversation_id}`}
                onPress={() => router.push(`/chat/${item.conversation_id}`)}
                style={styles.row}
              >
                <View>
                  <Avatar uri={other?.photo} name={title} size={52} />
                  {other?.online && <View style={styles.onlineDot} testID={`online-${item.conversation_id}`} />}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="label" numberOfLines={1}>{title}</AppText>
                  <AppText
                    variant="caption"
                    color={item.unread > 0 ? colors.onSurface : colors.onSurfaceTertiary}
                    weight={item.unread > 0 ? "semibold" : "regular"}
                    numberOfLines={1}
                    style={{ marginTop: 3 }}
                  >
                    {item.last_message || "Démarrer la conversation"}
                  </AppText>
                </View>
                {item.unread > 0 && (
                  <View style={styles.unreadBadge} testID={`unread-${item.conversation_id}`}>
                    <AppText variant="caption" color={colors.onBrandPrimary} weight="bold">{item.unread}</AppText>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Pas de messages"
              subtitle="Contactez un profil pour démarrer une conversation."
              cta="Parcourir"
              onCta={() => router.push("/(tabs)")}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.surface },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: spacing.sm },
});
