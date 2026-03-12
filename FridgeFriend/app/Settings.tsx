import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
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

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { colors, fontWeight, spacing } from "../styles/tokens";

export default function Settings() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const [loading, setLoading] = useState(false);
  const [periodText, setPeriodText] = useState("0");

  const loadSettings = async () => {
    if (!user_id) return;
    try {
      setLoading(true);
      const r = await fetch(`${API_BASE_URL}/user/${user_id}/settings`);
      if (!r.ok) throw new Error("Failed to load settings");
      const data = await r.json();
      setPeriodText(String(data.notification_period_preference ?? 0));
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
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert("Invalid value", "Please enter a number ≥ 0.");
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
        const txt = await resp.text().catch(() => "");
        console.error("Save settings failed:", resp.status, txt);
        Alert.alert("Error", "Failed to save settings.");
        return;
      }

      const data: {
        notification_period_preference: number;
        overrideExisting: boolean;
        pending: { user_product_id: number; product_name: string; days_left: number }[];
      } = await resp.json();

      if (Array.isArray(data.pending) && data.pending.length > 0) {
        const ok = await registerForLocalNotificationsAsync();
        if (ok) {
          for (const row of data.pending) {
            await sendExpiryNotification(String(row.product_name), Number(row.days_left));

            await fetch(`${API_BASE_URL}/user_products/${row.user_product_id}/markNotified`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      Alert.alert("Saved", "Notification preference updated.");
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
          router.replace("/LoginScreen");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.label}>Notify me this many days before expiry</Text>

          <TextInput
            value={periodText}
            onChangeText={setPeriodText}
            placeholder="0"
            keyboardType="number-pad"
            style={[formStyles.inputAlt, styles.input]}
          />

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.primary, styles.buttonSpacing]}
            onPress={onPressSave}
          >
            <Text style={buttonStyles.primaryText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.accent, styles.buttonSpacing]}
            onPress={goManageStores}
          >
            <Text style={buttonStyles.accentText}>Manage stores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.danger, styles.buttonSpacing]}
            onPress={logout}
          >
            <Text style={buttonStyles.dangerText}>Log out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.secondary]}
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
    ...commonStyles.screenPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.primaryTextOn,
    fontSize: 22,
    marginBottom: spacing.xxl,
    fontWeight: fontWeight.black,
  },
  card: {
    width: "100%",
    maxWidth: 360,
  },
  label: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: 0,
  },
  buttonSpacing: {
    marginBottom: spacing.md,
  },
});