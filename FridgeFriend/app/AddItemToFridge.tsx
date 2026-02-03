import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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

type Store = { id: number; name: string };

export default function AddItemToFridge() {
  const router = useRouter();
  const { user_id, product_id, product_name } = useLocalSearchParams<{
    user_id?: string;
    product_id?: string;
    product_name?: string;
  }>();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [newStoreName, setNewStoreName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    return `Add Item: ${product_name ?? "Unnamed Product"}`;
  }, [product_name]);

  const loadStores = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stores`);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Stores fetch error:", e);
      setStores([]);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const createStore = async () => {
    const trimmed = newStoreName.trim();
    if (!trimmed) {
      Alert.alert("Missing store name", "Enter a store name to create it.");
      return;
    }

    try {
      setLoading(true);

      const resp = await fetch(`${API_BASE_URL}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("Create store failed:", resp.status, txt);
        Alert.alert("Error", "Failed to create store.");
        return;
      }

      const created = await resp.json();
      await loadStores();
      setSelectedStoreId(Number(created.store_id));
      setNewStoreName("");
    } catch (e) {
      console.error("Create store error:", e);
      Alert.alert("Error", "Unable to create store.");
    } finally {
      setLoading(false);
    }
  };

  const confirmAdd = async () => {
    if (!user_id || !product_id) {
      Alert.alert("Error", "Missing required information.");
      return;
    }

    // expiryDate is optional; if provided, do a basic YYYY-MM-DD sanity check
    const trimmedExpiry = expiryDate.trim();
    const expiryToSend =
      trimmedExpiry.length === 0 ? null : trimmedExpiry;

    if (expiryToSend) {
      const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(expiryToSend);
      if (!okFormat) {
        Alert.alert("Invalid expiry date", "Use the format YYYY-MM-DD or leave it blank.");
        return;
      }
    }

    try {
      setLoading(true);

      const addResp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user_id,
          productId: Number(product_id),
          storeId: selectedStoreId,
          expiryDate: expiryToSend,
        }),
      });

      if (!addResp.ok) {
        const txt = await addResp.text().catch(() => "");
        console.error("Add product failed:", addResp.status, txt);
        Alert.alert("Error", "Failed to add item.");
        return;
      }

      const inserted = await addResp.json();

      const userProductId = inserted.user_product_id;
      const daysLeft =
        inserted.days_left === null || inserted.days_left === undefined
          ? null
          : Number(inserted.days_left);

      const effectivePeriodDays =
        inserted.effective_period_days === null || inserted.effective_period_days === undefined
          ? null
          : Number(inserted.effective_period_days);

      // Only attempt notification if expiry date exists (daysLeft is not null)
      if (
        daysLeft !== null &&
        effectivePeriodDays !== null &&
        daysLeft <= effectivePeriodDays
      ) {
        const ok = await registerForLocalNotificationsAsync();
        if (ok) {
          await sendExpiryNotification(product_name ?? "Item", daysLeft);

          if (userProductId) {
            await fetch(
              `${API_BASE_URL}/user_products/${userProductId}/markNotified`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      Alert.alert("Added!", "Item added to your fridge.");
        router.replace({
        pathname: "/(tabs)",
        params: { user_id: String(user_id) },
      });

    } catch (e) {
      console.error("Confirm add error:", e);
      Alert.alert("Error", "Unable to add item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Store (optional)</Text>

            <TouchableOpacity
              style={[
                styles.storeButton,
                selectedStoreId === null ? styles.storeButtonSelected : null,
              ]}
              onPress={() => setSelectedStoreId(null)}
            >
              <Text style={styles.storeButtonText}>No store</Text>
            </TouchableOpacity>

            <ScrollView style={styles.storeList} contentContainerStyle={styles.storeListContent}>
              {stores.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.storeButton,
                    selectedStoreId === s.id ? styles.storeButtonSelected : null,
                  ]}
                  onPress={() => setSelectedStoreId(s.id)}
                >
                  <Text style={styles.storeButtonText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: 10 }]}>Create new store</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. Aldi"
                value={newStoreName}
                onChangeText={setNewStoreName}
              />
              <TouchableOpacity style={styles.smallButton} onPress={createStore}>
                <Text style={styles.smallButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry date (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (leave blank for none)"
              value={expiryDate}
              onChangeText={setExpiryDate}
            />
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={confirmAdd}>
            <Text style={styles.confirmButtonText}>Confirm and Add</Text>
          </TouchableOpacity>
        </>
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
  title: { color: "white", fontSize: 18, marginBottom: 12, textAlign: "center" },

  section: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6 },

  storeList: { maxHeight: 220 },
  storeListContent: { paddingBottom: 4 },

  storeButton: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  storeButtonSelected: {
    backgroundColor: "#ffcc00",
  },
  storeButtonText: { color: "#333", fontWeight: "700" },

  input: {
    width: "100%",
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 8,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  smallButton: {
    backgroundColor: "#663399",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  smallButtonText: { color: "#fff", fontWeight: "700" },

  confirmButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  confirmButtonText: {
    color: "#663399",
    fontSize: 16,
    fontWeight: "bold",
  },
});
