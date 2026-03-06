import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

type FrequentRow = {
  product_id: number;
  product_name: string;
  store_id: number | null;
  store_name: string | null;
  used_count: number;
  last_used_at: string | null;
};

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function FrequentlyUsed() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FrequentRow[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/frequentItems?limit=30`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("frequentItems failed:", res.status, txt);
        throw new Error("Fetch failed");
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load frequently used items.");
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

  const onPick = (row: FrequentRow) => {
    if (!userId) return;

    router.push({
      pathname: "/AddItemToFridge",
      params: {
        user_id: String(userId),
        product_id: String(row.product_id),
        product_name: row.product_name,
        // optional: you can also pass a suggested store
        store_id: row.store_id === null ? "" : String(row.store_id),
        store_name: row.store_name ?? "",
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Frequently Used</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.product_id) + ":" + String(it.store_id ?? "ns")}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.product_name}</Text>
                <Text style={styles.meta}>
                  {item.store_name ? `Store: ${item.store_name}` : "No store"}
                  {"  •  "}
                  Used: {item.used_count}
                </Text>
              </View>

              <Text style={styles.cta}>Add →</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No frequently used items yet.</Text>
          }
        />
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#663399", padding: 16 },
  title: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 12 },

  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: { fontWeight: "900", color: "#333" },
  meta: { marginTop: 4, color: "#666", fontWeight: "700", fontSize: 12 },
  cta: { fontWeight: "900", color: "#663399" },

  empty: { color: "#fff", opacity: 0.9, marginTop: 10, fontWeight: "800" },

  backBtn: { marginTop: 10, alignSelf: "flex-start" },
  backText: { color: "#fff", fontWeight: "900" },
});