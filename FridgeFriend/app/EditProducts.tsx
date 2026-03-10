import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config/apiConfig";

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type FoodTypeRow = { id: number; name: string };
type ProductRow = {
  id: number;
  name: string;
  food_type: number | null;
  is_system?: boolean;
  owner_user_id?: number | null;
};

const PAGE = 30;

// Merge where NEW data wins by id
function mergeByIdNewWins(prev: ProductRow[], next: ProductRow[]) {
  const m = new Map<number, ProductRow>();

  // put prev first...
  for (const p of prev) {
    const id = Number(p?.id);
    if (!Number.isFinite(id)) continue;
    m.set(id, p);
  }

  // ...then overwrite with next (NEW wins)
  for (const p of next) {
    const id = Number(p?.id);
    if (!Number.isFinite(id)) continue;
    m.set(id, p);
  }

  return Array.from(m.values());
}

export default function EditProducts() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; refresh?: string }>();

  const userIdNum = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const refreshToken = params.refresh ?? "";

  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [foodTypeNameById, setFoodTypeNameById] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState<string>("");

  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const queryRef = useRef("");
  const loadingMoreRef = useRef(false);

  const loadFoodTypesIndex = useCallback(async () => {
    if (!userIdNum) return;

    try {
        const catRes = await fetch(
        `${API_BASE_URL}/categories?userId=${encodeURIComponent(String(userIdNum))}`
        );

        if (!catRes.ok) {
        const txt = await catRes.text().catch(() => "");
        throw new Error(txt || `HTTP ${catRes.status}`);
        }

        const catData = await catRes.json();
        const categories = Array.isArray(catData) ? catData : [];

        const m = new Map<number, string>();

        await Promise.all(
        categories.map(async (cat: any) => {
            const ftRes = await fetch(
            `${API_BASE_URL}/categories/${encodeURIComponent(String(cat.id))}/food?userId=${encodeURIComponent(String(userIdNum))}`
            );

            if (!ftRes.ok) {
            const txt = await ftRes.text().catch(() => "");
            throw new Error(txt || `HTTP ${ftRes.status}`);
            }

            const ftData = await ftRes.json();
            const arr = Array.isArray(ftData) ? ftData : [];

            for (const ft of arr) {
            m.set(Number(ft.id), String(ft.name));
            }
        })
        );

        setFoodTypeNameById(m);
    } catch (e) {
        console.error("foodTypes fetch error:", e);
        setFoodTypeNameById(new Map());
    }
    }, [userIdNum]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!userIdNum) return;

      if (!reset) {
        if (!hasMoreRef.current) return;
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setErrorText("");
      }

      try {
        const currentQuery = queryRef.current.trim();
        const offset = reset ? 0 : offsetRef.current;

        const qs =
          `userId=${encodeURIComponent(String(userIdNum))}` +
          `&q=${encodeURIComponent(currentQuery)}` +
          `&limit=${PAGE}` +
          `&offset=${offset}`;

        const r = await fetch(`${API_BASE_URL}/products/search?${qs}`);
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(txt || `HTTP ${r.status}`);
        }

        const data = await r.json();
        const arrRaw: ProductRow[] = Array.isArray(data) ? data : [];

        // Only show user-owned, non-system products
        const arr = arrRaw.filter((p) => {
          const isSystem = p.is_system === true;
          const owner = p.owner_user_id == null ? null : Number(p.owner_user_id);
          return !isSystem && owner === userIdNum;
        });

        if (reset) {
          setItems(arr); // replace list completely on reset
          offsetRef.current = arrRaw.length; // keep paging aligned with server
        } else {
          setItems((prev) => mergeByIdNewWins(prev, arr));
          offsetRef.current = offset + arrRaw.length;
        }

        hasMoreRef.current = arrRaw.length === PAGE;
      } catch (e: any) {
        console.error("products/search error:", e);
        setErrorText(e?.message || "Network error");
        hasMoreRef.current = false;
      } finally {
        if (reset) setLoading(false);
        else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [userIdNum]
  );

  // Initial load
  useEffect(() => {
    if (!userIdNum) return;
    queryRef.current = "";
    hasMoreRef.current = true;
    offsetRef.current = 0;
    loadFoodTypesIndex();
    fetchPage(true);
  }, [userIdNum, loadFoodTypesIndex, fetchPage]);

  // Debounced search
  useEffect(() => {
    if (!userIdNum) return;
    queryRef.current = q;

    const t = setTimeout(() => {
      hasMoreRef.current = true;
      offsetRef.current = 0;
      fetchPage(true);
    }, 250);

    return () => clearTimeout(t);
  }, [q, userIdNum, fetchPage]);

  // Guaranteed refresh when coming back (router.replace adds refresh param)
  useEffect(() => {
    if (!userIdNum) return;
    if (!refreshToken) return;

    hasMoreRef.current = true;
    offsetRef.current = 0;

    loadFoodTypesIndex();
    fetchPage(true);
  }, [refreshToken, userIdNum, loadFoodTypesIndex, fetchPage]);

  // Still keep focus refresh (nice when navigating normally)
  useFocusEffect(
    useCallback(() => {
        if (!userIdNum) return;

        queryRef.current = q;
        hasMoreRef.current = true;
        offsetRef.current = 0;

        loadFoodTypesIndex();
        fetchPage(true);
    }, [userIdNum, q, loadFoodTypesIndex, fetchPage])
  );

  const onEdit = (p: ProductRow) => {
    if (!userIdNum) return;
    router.push({
      pathname: "/EditProduct",
      params: { user_id: String(userIdNum), product_id: String(p.id) },
    });
  };

  const renderItem = ({ item }: { item: ProductRow }) => {
    const ftName =
      item.food_type != null ? foodTypeNameById.get(Number(item.food_type)) : null;

    return (
      <TouchableOpacity style={styles.row} onPress={() => onEdit(item)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>Food type: {ftName ?? "None"}</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Products</Text>

      <TextInput
        style={styles.search}
        placeholder="Search your products…"
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
      />

      {loading && <ActivityIndicator />}

      {!loading && !!errorText && <Text style={styles.errorText}>{errorText}</Text>}

      {!loading && !errorText && items.length === 0 && (
        <Text style={styles.emptyText}>No products found.</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(it) => `p_${String(it.id)}`}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!loading && !loadingMore) fetchPage(false);
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 14, paddingTop: 18 },
  title: { fontSize: 22, fontWeight: "900" },

  search: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  row: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: { fontWeight: "900" },
  meta: { marginTop: 4, color: "#666", fontSize: 12 },
  chev: { fontSize: 22, fontWeight: "900", color: "#999" },

  errorText: { marginTop: 12, color: "#b00020", fontWeight: "800" },
  emptyText: { marginTop: 12, color: "#666" },

  backBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  backText: { color: "#fff", fontWeight: "900" },
});