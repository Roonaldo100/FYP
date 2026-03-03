import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

type ExpiringSoonRow = {
  product_id: number;
  product_name: string;
  store_id: number | null;
  store_name: string | null;
  quantity: number;
  nearest_expiry: string;
  days_left: number;
  effective_period_days: number;
};

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ExpiringSoon() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExpiringSoonRow[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/expiringSoon`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load expiring soon items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openProduct = (it: ExpiringSoonRow) => {
    if (!userId) return;

    router.push({
      pathname: "/ExpiryBuckets",
      params: {
        user_id: String(userId),
        productId: String(it.product_id),
        productName: it.product_name,
        storeId: it.store_id === null ? "" : String(it.store_id),
        storeName: it.store_name ?? "No store",
      },
    });
  };

  const removeOne = async (it: ExpiringSoonRow) => {
    if (!userId) return;

    Alert.alert(
      "Remove one item?",
      `Remove 1 "${it.product_name}" from the bucket expiring on ${it.nearest_expiry}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove 1",
          style: "destructive",
          onPress: async () => {
            try {
              const resp = await fetch(`${API_BASE_URL}/user_products/removeByExpiry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: userId,
                  productId: it.product_id,
                  storeId: it.store_id, // null allowed
                  expiryDate: it.nearest_expiry,
                  quantity: 1,
                }),
              });

              if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                console.error("removeByExpiry failed:", resp.status, txt);
                throw new Error("Remove failed");
              }

              await load();
            } catch (e) {
              console.error(e);
              Alert.alert("Error", "Could not remove item.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Expiring soon</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : !items.length ? (
        <Text style={styles.empty}>No items expiring within your notification windows.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => `${it.product_id}-${String(it.store_id)}-${idx}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => openProduct(item)} activeOpacity={0.85} style={{ flex: 1 }}>
                <Text style={styles.name}>{item.product_name}</Text>
                <Text style={styles.meta}>
                  Store: {item.store_name ?? "No store"} • Qty: {item.quantity}
                </Text>
                <Text style={styles.meta}>
                  Expires: {item.nearest_expiry} • In {item.days_left} day(s) • Window:{" "}
                  {item.effective_period_days} day(s)
                </Text>
                <Text style={styles.tapHint}>Tap to manage expiry buckets →</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.removeBtn} onPress={() => removeOne(item)}>
                <Text style={styles.removeText}>Remove 1</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#663399", padding: 16, paddingTop: 40 },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  backBtn: { backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  backText: { color: "#663399", fontWeight: "900" },
  title: { color: "white", fontSize: 20, fontWeight: "900" },
  empty: { color: "white", marginTop: 10, opacity: 0.9 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: { fontWeight: "900", color: "#333", fontSize: 16 },
  meta: { marginTop: 6, color: "#666", fontSize: 12 },
  tapHint: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#663399" },

  removeBtn: {
    backgroundColor: "#b00020",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  removeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});