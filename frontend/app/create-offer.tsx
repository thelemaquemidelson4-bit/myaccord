import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Input } from "@/src/components/ui";
import { SelectField } from "@/src/components/form";
import { api } from "@/src/api/client";
import { SPORTS, LEVELS, POSITIONS } from "@/src/constants/data";
import { colors, spacing } from "@/src/theme/theme";

export default function CreateOffer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.get(`/offers/${id}`);
        const o = data.offer;
        setTitle(o.title || "");
        setSport(o.sport || null);
        setPosition(o.position || null);
        setLevel(o.level || null);
        setLocation(o.location || "");
        setDescription(o.description || "");
      } catch {}
    })();
  }, [id]);

  const save = async () => {
    setError(null);
    if (!title || !sport || !description) {
      setError("Titre, sport et description sont requis.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/offers/${id}`, { title, sport, position, level, location, description });
      } else {
        await api.post("/offers", { title, sport, position, level, location, description });
      }
      router.back();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const positionOptions = sport ? POSITIONS[sport] || ["Autre"] : ["Autre"];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="offer-create-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="label">{isEdit ? "Modifier l'offre" : "Nouvelle offre"}</AppText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={90}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <Input label="Titre de l'offre" placeholder="Ex: Recherche attaquant U21" value={title} onChangeText={setTitle} testID="offer-title" />
        <SelectField label="Sport" value={sport} options={SPORTS} onChange={(v) => { setSport(v); setPosition(null); }} testID="offer-sport" />
        <SelectField label="Poste recherché" value={position} options={positionOptions} onChange={setPosition} testID="offer-position" />
        <SelectField label="Niveau" value={level} options={LEVELS} onChange={setLevel} testID="offer-level" />
        <Input label="Localisation" placeholder="Ex: Lyon, France" icon="location-outline" value={location} onChangeText={setLocation} testID="offer-location" />
        <Input
          label="Description"
          placeholder="Décrivez le profil recherché, les conditions…"
          value={description}
          onChangeText={setDescription}
          multiline
          testID="offer-description"
        />
        {error && <AppText variant="caption" color={colors.error} testID="offer-error">{error}</AppText>}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button title={isEdit ? "Enregistrer" : "Publier l'offre"} full loading={saving} onPress={save} testID="offer-publish" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
});
