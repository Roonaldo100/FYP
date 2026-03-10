import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

type ProductRow = {
  id: number;
  name: string;
  food_type: number | null;
  is_system: boolean;
  owner_user_id: number | null;
};

export default function ProductPicker() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE = 30;

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const queryRef = useRef("");

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!user_id) return;

      if (!reset) {
        if (!hasMoreRef.current) return;
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const currentQuery = queryRef.current.trim();
        const offset = reset ? 0 : offsetRef.current;

        const qs =
          `userId=${encodeURIComponent(String(user_id))}` +
          `&q=${encodeURIComponent(currentQuery)}` +
          `&limit=${PAGE}` +
          `&offset=${offset}`;

        const r = await fetch(`${API_BASE_URL}/products/search?${qs}`);
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.error("products/search failed:", r.status, txt);
          hasMoreRef.current = false;
          return;
        }

        const data: ProductRow[] = await r.json();
        const arr = Array.isArray(data) ? data : [];

        if (reset) {
          setItems(arr);
          offsetRef.current = PAGE;
        } else {
          setItems((prev) => [...prev, ...arr]);
          offsetRef.current = offset + PAGE;
        }

        hasMoreRef.current = arr.length === PAGE;
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [user_id]
  );

  useEffect(() => {
    queryRef.current = q;

    const t = setTimeout(() => {
      hasMoreRef.current = true;
      offsetRef.current = 0;
      fetchPage(true);
    }, 250);

    return () => clearTimeout(t);
  }, [q, fetchPage]);

  const onPick = (p: ProductRow) => {
    router.push({
      pathname: "/AddItemToFridge",
      params: {
        user_id: String(user_id),
        product_id: String(p.id),
        product_name: p.name,
      },
    });
  };

  const onEndReached = () => {
    if (!loading) fetchPage(false);
  };

  const goManualAdd = () => {
    if (!user_id) return;
    router.push({
      pathname: "/ManualAddProduct",
      params: { user_id: String(user_id) },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add an item</Text>

      <TouchableOpacity style={styles.manualBtn} onPress={goManualAdd}>
        <Text style={styles.manualBtnText}>➕ Add a brand new product (Manual)</Text>
      </TouchableOpacity>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search products…"
        style={styles.search}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.owner_user_id ? "Your product" : "System product"}
              </Text>
            </TouchableOpacity>
          )}
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
  title: { color: "white", fontSize: 22, fontWeight: "800", marginBottom: 12 },
  manualBtn: {
    backgroundColor: "#ffcc00",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  manualBtnText: { color: "#333", fontWeight: "900" },
  search: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontWeight: "800", color: "#333" },
  meta: { marginTop: 4, color: "#666" },
  backBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backText: { color: "#663399", fontWeight: "800" },
});