import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, ScrollView, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, fonts, font } from "@/src/theme/theme";

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Sélectionner",
  testID,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AppText variant="label" style={{ marginBottom: spacing.sm }}>{label}</AppText>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.select}>
        <AppText variant="body" color={value ? colors.onSurface : colors.info}>
          {value || placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.onSurfaceTertiary} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <AppText variant="displaySm" style={{ marginBottom: spacing.md }}>{label}</AppText>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const active = value === opt;
              return (
                <Pressable
                  key={opt}
                  testID={`option-${opt}`}
                  onPress={() => { onChange(opt); setOpen(false); }}
                  style={[styles.option, active && { backgroundColor: colors.brandTertiary }]}
                >
                  <AppText variant="body" color={active ? colors.onBrandTertiary : colors.onSurfaceSecondary} weight={active ? "semibold" : "regular"}>
                    {opt}
                  </AppText>
                  {active && <Ionicons name="checkmark" size={18} color={colors.brandPrimary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function PhotoPicker({
  uri,
  onPick,
  label = "Photo de profil",
}: {
  uri?: string | null;
  onPick: (base64: string) => void;
  label?: string;
}) {
  const [denied, setDenied] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setDenied(true);
      return;
    }
    setDenied(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      onPick(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  return (
    <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
      <Pressable testID="photo-picker" onPress={pick} style={styles.photoWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="camera" size={28} color={colors.onSurfaceTertiary} />
          </View>
        )}
        <View style={styles.photoEdit}>
          <Ionicons name="pencil" size={14} color={colors.onBrandPrimary} />
        </View>
      </Pressable>
      <AppText variant="caption" style={{ marginTop: spacing.sm }}>{label}</AppText>
      {denied && (
        <Button
          title="Ouvrir les réglages"
          variant="ghost"
          onPress={() => Linking.openSettings()}
          style={{ marginTop: spacing.sm, height: 40 }}
          testID="open-settings"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  select: {
    height: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center", marginBottom: spacing.lg,
  },
  option: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  photoWrap: { width: 96, height: 96 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceTertiary },
  photoPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  photoEdit: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: colors.surface,
  },
});
