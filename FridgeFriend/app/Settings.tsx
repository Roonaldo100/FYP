import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import {
  registerForLocalNotificationsAsync,
  sendExpiryNotification,
} from "../lib/notifications";
import { useTheme } from "../lib/theme";
import { makeCommonStyles } from "../styles/common";
import { makeFormStyles } from "../styles/forms";
import { makeButtonStyles } from "../styles/buttons";
import { fontWeight, spacing } from "../styles/tokens";

export default function Settings() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const { colors, isDark, setMode } = useTheme();
  const commonStyles = useMemo(() => makeCommonStyles(colors), [colors]);
  const formStyles = useMemo(() => makeFormStyles(colors), [colors]);
  const buttonStyles = useMemo(() => makeButtonStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [periodText, setPeriodText] = useState("0");
  const [maxNotificationDays, setMaxNotificationDays] = useState<number | null>(null);

  const loadSettings = async () => {
    if (!user_id) return;

    try {
      setLoading(true);

      const r = await fetch(`${API_BASE_URL}/user/${user_id}/settings`);
      if (!r.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await r.json();

      setPeriodText(String(data.notification_period_preference ?? 0));
      setMaxNotificationDays(
        Number.isFinite(Number(data.max_notification_days))
          ? Number(data.max_notification_days)
          : null
      );
    } catch (e) {
      console.error("Load settings error:", e);
      Alert.alert("Error", "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user_id]);

  const save = async (overrideExisting: boolean) => {
    if (!user_id) return;

    const parsed = Number(periodText);

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      Alert.alert("Invalid value", "Please enter a whole number 0 or greater.");
      return;
    }

    if (maxNotificationDays !== null && parsed > maxNotificationDays) {
      Alert.alert(
        "Value too large",
        `Please enter a value no greater than ${maxNotificationDays}.`
      );
      return;
    }

    try {
      setLoading(true);

      const resp = await fetch(
        `${API_BASE_URL}/user/${user_id}/settings/notificationPeriod`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notification_period_preference: parsed,
            overrideExisting,
          }),
        }
      );

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        Alert.alert("Error", data?.message || "Failed to save settings.");
        return;
      }

      const data = await resp.json();

      if (Array.isArray(data.pending) && data.pending.length > 0) {
        const ok = await registerForLocalNotificationsAsync();

        if (ok) {
          for (const row of data.pending) {
            await sendExpiryNotification(
              String(row.product_name),
              Number(row.days_left)
            );

            await fetch(
              `${API_BASE_URL}/user_products/${row.user_product_id}/markNotified`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      Alert.alert("Saved", "Settings updated.");
      router.back();
    } catch (e) {
      console.error("Save settings error:", e);
      Alert.alert("Error", "Unable to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const onPressSave = () => {
    Alert.alert(
      "Apply to existing items?",
      "Some items may have custom expiry notification rules.\n\nOverride those rules for a one-time sweep?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save only", onPress: () => save(false) },
        { text: "Override existing", style: "destructive", onPress: () => save(true) },
      ]
    );
  };

  const goManageStores = () => {
    if (!user_id) return;

    router.push({
      pathname: "/ManageStores",
      params: { user_id: String(user_id) },
    });
  };

  const logout = () => {
    Alert.alert("Log out?", "Return to the login screen?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          router.dismissAll();
          router.replace("/LoginScreen");
        },
      },
    ]);
  };

  return (
    <View style={[commonStyles.screenPrimary, styles.container]}>
      <Text style={[styles.title, { color: colors.primaryTextOn }]}>Settings</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : (
        <View
          style={[
            commonStyles.card,
            styles.card,
            { borderColor: colors.borderSoft },
          ]}
        >
          <View style={styles.themeRow}>
            <View style={styles.themeTextCol}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Dark mode
              </Text>
              <Text style={[styles.settingHint, { color: colors.textMuted }]}>
                Toggle dark mode for the whole app
              </Text>
            </View>

            <Switch
              value={isDark}
              onValueChange={(value) => setMode(value ? "dark" : "light")}
            />
          </View>

          <Text style={[styles.settingLabel, styles.sectionGap, { color: colors.text }]}>
            Notify me this many days before expiry
          </Text>

          <TextInput
            value={periodText}
            onChangeText={setPeriodText}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[formStyles.inputAlt, styles.input]}
          />

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.primary, styles.buttonGap]}
            onPress={onPressSave}
          >
            <Text style={buttonStyles.primaryText}>Save notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.accent, styles.buttonGap]}
            onPress={goManageStores}
          >
            <Text style={buttonStyles.accentText}>Manage stores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.danger, styles.buttonGap]}
            onPress={logout}
          >
            <Text style={buttonStyles.dangerText}>Log out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.secondary, styles.buttonGap]}
            onPress={() => router.back()}
          >
            <Text style={buttonStyles.secondaryText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    marginBottom: spacing.lg,
  },
  card: {
    width: "100%",
    borderWidth: 1,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingLabel: {
    fontWeight: fontWeight.bold,
  },
  settingHint: {
    marginTop: spacing.xs,
  },
  sectionGap: {
    marginTop: spacing.xl,
  },
  input: {
    marginTop: spacing.sm,
    marginBottom: 0,
  },
  buttonGap: {
    marginTop: spacing.md,
  },
});