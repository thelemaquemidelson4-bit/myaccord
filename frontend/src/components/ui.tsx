import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  View,
  ViewStyle,
  StyleSheet,
  TextInput,
  TextInputProps,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, font, radius, spacing } from "@/src/theme/theme";

type TxtProps = TextProps & {
  variant?: "display" | "displaySm" | "title" | "body" | "label" | "caption";
  color?: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
  center?: boolean;
};

export function AppText({ variant = "body", color, weight, center, style, ...rest }: TxtProps) {
  const base = variantStyles[variant];
  const family = weightFamily(variant, weight);
  return (
    <Text
      {...rest}
      style={[
        base,
        { fontFamily: family, color: color || base.color },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

function weightFamily(variant: string, weight?: string) {
  const isDisplay = variant === "display" || variant === "displaySm";
  if (isDisplay) {
    if (weight === "bold") return fonts.displayBold;
    if (weight === "medium") return fonts.displayMedium;
    return fonts.displaySemibold;
  }
  if (weight === "bold") return fonts.bodyBold;
  if (weight === "semibold") return fonts.bodySemibold;
  if (weight === "medium") return fonts.bodyMedium;
  return fonts.body;
}

const variantStyles: Record<string, any> = StyleSheet.create({
  display: { fontFamily: fonts.displayBold, fontSize: font["4xl"], color: colors.onSurface, letterSpacing: 0.3 },
  displaySm: { fontFamily: fonts.displaySemibold, fontSize: font["2xl"], color: colors.onSurface, letterSpacing: 0.3 },
  title: { fontFamily: fonts.bodyBold, fontSize: font.xl, color: colors.onSurface },
  body: { fontFamily: fonts.body, fontSize: font.base, color: colors.onSurfaceSecondary },
  label: { fontFamily: fonts.bodySemibold, fontSize: font.base, color: colors.onSurface },
  caption: { fontFamily: fonts.body, fontSize: font.sm, color: colors.onSurfaceTertiary },
});

type BtnProps = PressableProps & {
  title: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  full?: boolean;
  testID?: string;
};

export function Button({ title, variant = "primary", loading, icon, full, style, onPress, disabled, testID, ...rest }: BtnProps) {
  const bg = variant === "primary" ? colors.brandPrimary : variant === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg = variant === "primary" ? colors.onBrandPrimary : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={(e) => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        variant === "ghost" && { borderWidth: 1, borderColor: colors.borderStrong },
        full && { alignSelf: "stretch" },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style as ViewStyle,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: spacing.sm }} />}
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: font.lg, color: fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

type InputProps = TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap };

export function Input({ label, icon, style, ...rest }: InputProps) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && (
        <AppText variant="label" style={{ marginBottom: spacing.sm }}>
          {label}
        </AppText>
      )}
      <View style={styles.inputWrap}>
        {icon && <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} style={{ marginRight: spacing.sm }} />}
        <TextInput
          placeholderTextColor={colors.info}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
    </View>
  );
}

export function Avatar({ uri, name, size = 48, sport }: { uri?: string | null; name?: string | null; size?: number; sport?: string | null }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  if (uri) {
    // Using RN Image via expo-image is imported at call sites; here keep simple View fallback if no uri.
    return <AvatarImage uri={uri} size={size} />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontFamily: fonts.displaySemibold, fontSize: size * 0.36, color: colors.onSurfaceTertiary }}>
        {initials}
      </Text>
    </View>
  );
}

import { Image as ExpoImage } from "expo-image";
function AvatarImage({ uri, size }: { uri: string; size: number }) {
  return (
    <ExpoImage
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
      contentFit="cover"
    />
  );
}

export function ChipRow({
  items,
  selected,
  onSelect,
  allLabel = "Tous",
  testIDPrefix = "chip",
}: {
  items: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  allLabel?: string;
  testIDPrefix?: string;
}) {
  const all = [null, ...items];
  return (
    <View style={styles.chipRowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowContent}
      >
        {all.map((it, i) => {
          const active = selected === it || (it === null && selected === null);
          return (
            <Pressable
              key={i}
              testID={`${testIDPrefix}-${it ?? "all"}`}
              onPress={() => onSelect(it)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemibold,
                  fontSize: font.base,
                  color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary,
                }}
              >
                {it ?? allLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  cta,
  onCta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.onSurfaceTertiary} />
      </View>
      <AppText variant="displaySm" center style={{ marginTop: spacing.lg }}>
        {title}
      </AppText>
      {subtitle && (
        <AppText variant="body" center color={colors.onSurfaceTertiary} style={{ marginTop: spacing.sm }}>
          {subtitle}
        </AppText>
      )}
      {cta && onCta && (
        <Button title={cta} onPress={onCta} variant="secondary" style={{ marginTop: spacing.xl, paddingHorizontal: spacing["2xl"] }} testID="empty-cta" />
      )}
    </View>
  );
}

export function Badge({ text, color = colors.brandTertiary, textColor = colors.onBrandTertiary }: { text: string; color?: string; textColor?: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: font.sm, color: textColor }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: font.lg },
  avatar: {
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
