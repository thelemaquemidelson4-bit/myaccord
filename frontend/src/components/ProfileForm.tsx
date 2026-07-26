import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Input, AppText } from "@/src/components/ui";
import { SelectField, PhotoPicker } from "@/src/components/form";
import { api, User } from "@/src/api/client";
import { SPORTS, LEVELS, GENDERS, POSITIONS } from "@/src/constants/data";
import { colors, spacing } from "@/src/theme/theme";

export function ProfileForm({
  user,
  onSaved,
  submitLabel,
}: {
  user: User;
  onSaved: (u: User) => void;
  submitLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const isRecruiter = user.role === "recruiter";
  const isFan = user.role === "fan";

  const [photo, setPhoto] = useState<string | null>(user.photo || null);
  const [name, setName] = useState(user.name || "");
  const [clubName, setClubName] = useState(user.club_name || "");
  const [location, setLocation] = useState(user.location || "");
  const [bio, setBio] = useState(user.bio || "");
  const [sport, setSport] = useState<string | null>(user.sport || null);
  const [position, setPosition] = useState<string | null>(user.position || null);
  const [level, setLevel] = useState<string | null>(user.level || null);
  const [gender, setGender] = useState<string | null>(user.gender || null);
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [height, setHeight] = useState(user.height ? String(user.height) : "");
  const [weight, setWeight] = useState(user.weight ? String(user.weight) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: any = { name, photo, location, bio };
      if (isRecruiter) {
        payload.club_name = clubName;
        payload.sport = sport;
      } else if (!isFan) {
        payload.sport = sport;
        payload.position = position;
        payload.level = level;
        payload.gender = gender;
        if (age) payload.age = parseInt(age, 10);
        if (height) payload.height = parseInt(height, 10);
        if (weight) payload.weight = parseInt(weight, 10);
      }
      const data = await api.put("/profile", payload);
      onSaved(data.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const positionOptions = sport ? POSITIONS[sport] || [] : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAwareScrollView
        bottomOffset={90}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoPicker uri={photo} onPick={setPhoto} label={isRecruiter ? "Logo / photo" : "Photo de profil"} />

        <Input label={isRecruiter ? "Nom du club / recruteur" : isFan ? "Nom / pseudo" : "Nom complet"} value={name} onChangeText={setName} testID="pf-name" />

        {isRecruiter && (
          <Input label="Nom officiel du club" placeholder="Ex: FC Talents" value={clubName} onChangeText={setClubName} testID="pf-club" />
        )}

        {!isFan && (
          <SelectField label="Sport" value={sport} options={SPORTS} onChange={(v) => { setSport(v); setPosition(null); }} testID="pf-sport" />
        )}

        {!isRecruiter && !isFan && (
          <>
            <SelectField label="Poste" value={position} options={positionOptions.length ? positionOptions : ["Autre"]} onChange={setPosition} testID="pf-position" />
            <SelectField label="Niveau" value={level} options={LEVELS} onChange={setLevel} testID="pf-level" />
            <SelectField label="Genre" value={gender} options={GENDERS} onChange={setGender} testID="pf-gender" />
            <Input label="Âge" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Ex: 22" testID="pf-age" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input label="Taille (cm)" value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="180" testID="pf-height" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Poids (kg)" value={weight} onChangeText={setWeight} keyboardType="number-pad" placeholder="75" testID="pf-weight" />
              </View>
            </View>
          </>
        )}

        <Input label="Localisation" placeholder="Ex: Paris, France" icon="location-outline" value={location} onChangeText={setLocation} testID="pf-location" />
        <Input
          label={isRecruiter ? "Présentation du club" : "Bio"}
          placeholder={isRecruiter ? "Décrivez votre club et vos besoins..." : "Parlez de votre parcours..."}
          value={bio}
          onChangeText={setBio}
          multiline
          testID="pf-bio"
        />

        {error && <AppText variant="caption" color={colors.error} testID="pf-error">{error}</AppText>}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface }}>
          <Button title={submitLabel} full loading={saving} onPress={save} testID="pf-save" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
