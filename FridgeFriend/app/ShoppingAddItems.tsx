import React, { useCallback, useEffect, useMemo, useState } from "react";
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

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Store = { id: number; name: string };
type InvCandidate = { product_id: number; product_name: string; qty_in_inventory: number };
type HistCandidate = { product_id: number; product_name: string; suggested_store_id: number | null; suggested_store_name: string | null; suggested_price: number | null };
type ProductHit = { id: number; name: string };

export default function ShoppingAddItems() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [defaultQtyText, setDefaultQtyText] = useState("1");

  const [inventory, setInventory] = useState<InvCandidate[]>([]);
  const [history, setHistory] = useState<HistCandidate[]>([]);

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<ProductHit[]>([]);

  const [customName, setCustomName] = useState("");

  const loadStores = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/stores?userId=${userId}`);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      setStores([]);
    }
  }, [userId]);

  const loadCandidates = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${API_BASE_URL}/user/${userId}/shopping/candidates/inventory`),
        fetch(`${API_BASE_URL}/user/${userId}/shopping/candidates/history`),
      ]);

      const inv = a.ok ? await a.json() : [];
      const hist = b.ok ? await b.json() : [];

      setInventory(Array.isArray(inv) ? inv : []);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch (e) {
      console.warn(e);
      setInventory([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStores();
    loadCandidates();
  }, [loadStores, loadCandidates]);

  const defaultQty = useMemo(() => {
    const n = Number(defaultQtyText);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return 1;
    return n;
  }, [defaultQtyText]);

  const addItem = useCallback(
    async (payload: any) => {
      if (!userId || !listId) return;

      try {
        const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const text = await res.text().catch(() => "");
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {}

        if (!res.ok) {
          Alert.alert("Error", data?.message || "Could not add item.");
          return;
        }
      } catch (e) {
        console.warn(e);
        Alert.alert("Error", "Could not add item.");
      }
    },
    [userId, listId]
  );

  const addProduct = async (productId: number) => {
    await addItem({
      productId,
      storeId: selectedStoreId,
      quantity: defaultQty,
    });
    Alert.alert("Added", "Item added to list.");
  };

  const addHistoryProduct = async (h: HistCandidate) => {
    const effectiveStoreId =
      selectedStoreId !== null ? selectedStoreId : (h.suggested_store_id ?? null);

    await addItem({
      productId: h.product_id,
      storeId: effectiveStoreId,
      quantity: defaultQty,
    });

    Alert.alert("Added", "Item added to list.");
  };

  const addCustom = async () => {
    const name = customName.trim();
    if (!name) {
      Alert.alert("Missing item", "Enter an item name.");
      return;
    }
    await addItem({
      customName: name,
      storeId: selectedStoreId,
      quantity: defaultQty,
    });
    setCustomName("");
    Alert.alert("Added", "Item added to list.");
  };

  const doSearch = useCallback(
    async (q: string) => {
      setSearchText(q);

      const trimmed = q.trim();
      if (!trimmed || trimmed.length < 2 || !userId) {
        setSearchHits([]);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/products/search?q=${encodeURIComponent(trimmed)}&userId=${encodeURIComponent(String(userId))}&limit=25&offset=0`
        );
        if (!res.ok) {
          setSearchHits([]);
          return;
        }
        const data: any[] = await res.json();
        const hits = (Array.isArray(data) ? data : []).map((x) => ({
          id: Number(x.id),
          name: String(x.name),
        }));
        setSearchHits(hits);
      } catch (e) {
        console.warn(e);
        setSearchHits([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [userId]
  );

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() =>
            router.replace({
              pathname: "/ShoppingListDetail",
              params: { user_id: String(userId), listId: String(listId) },
            })
          }
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Add items</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Store for adds (optional)</Text>

          <TouchableOpacity
            style={[styles.storeChip, selectedStoreId === null && styles.storeChipSelected]}
            onPress={() => setSelectedStoreId(null)}
          >
            <Text style={styles.storeChipText}>No store</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {stores.map((s) => {
              const selected = selectedStoreId === s.id;
              return (
                <TouchableOpacity
                  key={String(s.id)}
                  style={[styles.storeChip, selected && styles.storeChipSelected]}
                  onPress={() => setSelectedStoreId(s.id)}
                >
                  <Text style={styles.storeChipText}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.cardTitle, { marginTop: 12 }]}>Default quantity</Text>
          <TextInput
            value={defaultQtyText}
            onChangeText={setDefaultQtyText}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="1"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add new item (no product needed)</Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Toothpaste"
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={addCustom}>
            <Text style={styles.primaryBtnText}>Add to list</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search products (optional)</Text>
          <TextInput
            value={searchText}
            onChangeText={doSearch}
            placeholder="Search products..."
            style={styles.input}
            autoCapitalize="none"
          />
          {searchLoading ? <ActivityIndicator /> : null}
          {!!searchHits.length && (
            <View style={{ marginTop: 10 }}>
              {searchHits.slice(0, 12).map((p) => (
                <TouchableOpacity key={String(p.id)} style={styles.row} onPress={() => addProduct(p.id)}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowAction}>Add</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pick from inventory</Text>
          {loading ? (
            <ActivityIndicator />
          ) : inventory.length ? (
            inventory.slice(0, 60).map((it) => (
              <TouchableOpacity key={String(it.product_id)} style={styles.row} onPress={() => addProduct(it.product_id)}>
                <Text style={styles.rowTitle}>{it.product_name}</Text>
                <Text style={styles.rowMeta}>In fridge: {it.qty_in_inventory}</Text>
                <Text style={styles.rowAction}>Add</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>No inventory items.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pick from history</Text>
          {loading ? (
            <ActivityIndicator />
          ) : history.length ? (
            history.slice(0, 80).map((it) => (
              <TouchableOpacity key={String(it.product_id)} style={styles.row} onPress={() => addHistoryProduct(it)}>
                <Text style={styles.rowTitle}>{it.product_name}</Text>
                <Text style={styles.rowMeta}>
                  Last: {it.suggested_store_name ?? "No store"}{" "}
                  {it.suggested_price != null ? `• €${Number(it.suggested_price).toFixed(2)}` : ""}
                </Text>
                <Text style={styles.rowAction}>Add</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>No historical items.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 14, paddingTop: 18 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#eee" },
  backText: { fontWeight: "800" },
  doneBtn: { backgroundColor: "#111", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  doneText: { color: "#fff", fontWeight: "800" },

  title: { marginTop: 12, fontSize: 22, fontWeight: "900" },

  card: { marginTop: 12, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee" },
  cardTitle: { fontWeight: "900" },

  input: { marginTop: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 },

  primaryBtn: { marginTop: 10, backgroundColor: "#111", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  storeChip: { backgroundColor: "#eee", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  storeChipSelected: { backgroundColor: "#ffcc00" },
  storeChipText: { fontWeight: "800" },

  row: { marginTop: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 10 },
  rowTitle: { fontWeight: "900" },
  rowMeta: { marginTop: 4, color: "#666", fontSize: 12 },
  rowAction: { marginTop: 6, fontWeight: "900", color: "#663399" },

  empty: { marginTop: 10, color: "#666" },
});