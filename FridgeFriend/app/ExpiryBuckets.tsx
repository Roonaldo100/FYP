import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig"; // adjust if needed (your index uses ../../config)

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
    storeId?: string;     // "" means null
    storeName?: string;
    foodTypeId?: string;  // optional
  }>();

  const userId = params.user_id;
  const productId = params.productId;
  const storeId = params.storeId ? params.storeId : ""; // "" => null

  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [newExpiry, setNewExpiry] = useState<string>(""); // YYYY-MM-DD or blank for no-expiry

  const storeLabel = useMemo(() => params.storeName ?? "No store", [params.storeName]);

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
    // allow blank => no expiry bucket
    const trimmed = newExpiry.trim();

    if (trimmed.length === 0) {
      await addToBucket(null);
      setNewExpiry("");
      return;
    }

    // basic YYYY-MM-DD validation
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

  backBtn: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  backBtnText: { color: "#663399", fontWeight: "800" },

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

  ctrlBtn: { backgroundColor: "#eee", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 10 },
  ctrlBtnDisabled: { opacity: 0.5 },
  ctrlBtnText: { fontSize: 18, fontWeight: "900", color: "#333" },

  addNewRow: { flexDirection: "row", marginTop: 8 },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { marginLeft: 10, backgroundColor: "#ffcc00", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  addBtnText: { fontWeight: "900", color: "#333" },
});