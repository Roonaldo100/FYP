import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig"; 

type Bucket = {
  expiry_date: string | null;
  quantity: number;
};

export default function ExpiryBuckets() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    productId?: string;
    productName?: string;
    storeId?: string; // "" means null
    storeName?: string;
    foodTypeId?: string; // optional
  }>();

  const userId = params.user_id;
  const productId = params.productId;
  const storeId = params.storeId ? params.storeId : ""; // "" => null

  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [newExpiry, setNewExpiry] = useState<string>(""); // YYYY-MM-DD or blank for no-expiry

  const storeLabel = useMemo(() => params.storeName ?? "No store", [params.storeName]);

  const [overrideText, setOverrideText] = useState<string>("");

  const fetchBuckets = useCallback(async () => {
    if (!userId || !productId) return;

    setLoading(true);
    try {
      const qs =
        `userId=${encodeURIComponent(userId)}` +
        `&productId=${encodeURIComponent(productId)}` +
        `&storeId=${encodeURIComponent(storeId)}`;

      const r = await fetch(`${API_BASE_URL}/user_products/buckets?${qs}`);
      const data = await r.json();
      setBuckets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchBuckets error:", e);
      Alert.alert("Error", "Could not load expiry buckets.");
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [userId, productId, storeId]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const saveOverride = useCallback(async () => {
    if (!userId || !productId) return;

    const t = overrideText.trim();
    if (t && (!Number.isFinite(Number(t)) || !Number.isInteger(Number(t)) || Number(t) < 0)) {
      Alert.alert("Invalid value", "Enter a whole number ≥ 0 (or leave blank).");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/user_products/setExpiryPeriod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate: null,
          expiryPeriodDays: t ? Number(t) : 0,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("setExpiryPeriod failed:", resp.status, txt);
        throw new Error("Update failed");
      }

      Alert.alert("Saved", "Expiry notification override updated.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update expiry notification override.");
    }
  }, [userId, productId, storeId, overrideText]);

  const addToBucket = async (expiryDate: string | null) => {
    if (!userId || !productId) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate, // <— key: ties the new row to the chosen bucket
          price: null,
        }),
      });

      if (!resp.ok) throw new Error("Add failed");
      await fetchBuckets();
    } catch (e) {
      console.error("addToBucket error:", e);
      Alert.alert("Error", "Could not add item to this expiry bucket.");
    }
  };

  const removeFromBucket = async (expiryDate: string | null) => {
    if (!userId || !productId) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/user_products/removeByExpiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate,
          quantity: 1,
        }),
      });

      if (!resp.ok) throw new Error("Remove failed");
      await fetchBuckets();
    } catch (e) {
      console.error("removeFromBucket error:", e);
      Alert.alert("Error", "Could not remove item from this expiry bucket.");
    }
  };

  const addNewExpiryBucket = async () => {
    const trimmed = newExpiry.trim();

    if (trimmed.length === 0) {
      await addToBucket(null);
      setNewExpiry("");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD (e.g. 2026-02-27).");
      return;
    }

    await addToBucket(trimmed);
    setNewExpiry("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{params.productName ?? "Product"}</Text>
      <Text style={styles.subtitle}>Store: {storeLabel}</Text>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.overrideCard}>
            <Text style={styles.overrideTitle}>Expiry notification override</Text>
            <Text style={styles.overrideHint}>
              Set days-before-expiry for this product + store. Use 0 (or blank) to follow Settings.
            </Text>

            <TextInput
              value={overrideText}
              onChangeText={setOverrideText}
              placeholder="e.g. 3"
              keyboardType="number-pad"
              style={styles.overrideInput}
            />

            <TouchableOpacity style={styles.saveOverrideBtn} onPress={saveOverride}>
              <Text style={styles.saveOverrideText}>Save override</Text>
            </TouchableOpacity>
          </View>

          {buckets.map((b, i) => (
            <View key={`${String(b.expiry_date)}-${i}`} style={styles.bucketRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bucketTitle}>
                  {b.expiry_date ? `Expires: ${b.expiry_date}` : "No expiry date"}
                </Text>
                <Text style={styles.bucketQty}>Qty: {b.quantity}</Text>
              </View>

              <TouchableOpacity
                style={[styles.ctrlBtn, b.quantity <= 0 && styles.ctrlBtnDisabled]}
                onPress={() => removeFromBucket(b.expiry_date)}
                disabled={b.quantity <= 0}
              >
                <Text style={styles.ctrlBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctrlBtn} onPress={() => addToBucket(b.expiry_date)}>
                <Text style={styles.ctrlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addNewRow}>
            <TextInput
              value={newExpiry}
              onChangeText={setNewExpiry}
              placeholder="New expiry YYYY-MM-DD (blank = no expiry)"
              style={styles.input}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addNewExpiryBucket}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#663399" },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "white", marginTop: 6, opacity: 0.9 },

  backBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#663399", fontWeight: "800" },

  overrideCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overrideTitle: { fontWeight: "900", color: "#333" },
  overrideHint: { marginTop: 6, color: "#666" },
  overrideInput: {
    marginTop: 10,
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveOverrideBtn: {
    marginTop: 10,
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveOverrideText: { fontWeight: "900", color: "#333" },

  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  bucketTitle: { color: "#333", fontWeight: "800" },
  bucketQty: { color: "#555", marginTop: 4 },

  ctrlBtn: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 10,
  },
  ctrlBtnDisabled: { opacity: 0.5 },
  ctrlBtnText: { fontSize: 18, fontWeight: "900", color: "#333" },

  addNewRow: { flexDirection: "row", marginTop: 8 },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    marginLeft: 10,
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  addBtnText: { fontWeight: "900", color: "#333" },
});