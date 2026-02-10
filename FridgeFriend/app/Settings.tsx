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

      // One-time sweep notifications
      if (Array.isArray(data.pending) && data.pending.length > 0) {
        const ok = await registerForLocalNotificationsAsync();
        if (ok) {
          for (const row of data.pending) {
            await sendExpiryNotification(String(row.product_name), Number(row.days_left));

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
        { text: "No (respect custom rules)", onPress: () => save(false) },
        { text: "Yes (override for sweep)", onPress: () => save(true) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <View style={styles.card}>
          <Text style={styles.label}>Notify me when an item expires within (days)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={periodText}
            onChangeText={setPeriodText}
            placeholder="e.g. 5"
          />

          <TouchableOpacity style={styles.saveButton} onPress={onPressSave}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#663399",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { color: "white", fontSize: 22, marginBottom: 16 },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#333", marginBottom: 8 },
  input: { backgroundColor: "#eee", borderRadius: 8, padding: 10, marginBottom: 12 },
  saveButton: {
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  saveText: { color: "#fff", fontWeight: "800" },
  backButton: { backgroundColor: "#eee", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  backText: { color: "#333", fontWeight: "800" },
});
