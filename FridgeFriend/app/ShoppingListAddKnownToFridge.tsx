import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Item = {
  id: number;
  name: string;
  product_id: number | null;
  custom_name: string | null;
  store_id: number | null;
  store_name: string | null;
  quantity: number;
};

type Group = {
  store_id: number | null;
  store_name: string;
  items: Item[];
};

type DetailResponse = {
  list: { id: number; name: string };
  groups: Group[];
};

export default function ShoppingListAddKnownToFridge() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const knownItems = useMemo(() => {
    const out: Item[] = [];
    for (const g of data?.groups || []) {
      for (const it of g.items || []) {
        if (it.product_id) out.push(it);
      }
    }
    return out;
  }, [data]);

  const load = useCallback(async () => {
    if (!userId || !listId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${listId}`);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const d: DetailResponse = await res.json();
      setData(d);
      setSelected({});
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load list.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, listId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: number) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  const selectAll = () => {
    const next: Record<number, boolean> = {};
    for (const it of knownItems) next[it.id] = true;
    setSelected(next);
  };

  const clearAll = () => setSelected({});

  const goCustom = () => {
    if (!userId || !listId) return;
    router.replace({
      pathname: "../ShoppingListCustomItems",
      params: { user_id: String(userId), listId: String(listId) },
    });
  };

  const addSelected = async () => {
    if (!userId || !listId) return;

    const itemIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (!itemIds.length) {
      // allow skipping known items entirely
      goCustom();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/addToInventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });

      const txt = await res.text().catch(() => "");
      let out: any = null;
      try {
        out = JSON.parse(txt);
      } catch {}

      if (!res.ok) {
        Alert.alert("Error", out?.message || "Could not add to fridge.");
        return;
      }

      Alert.alert("Added", `Added ${Number(out?.added_inventory_rows ?? 0)} item(s) to your fridge.`);
      goCustom();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not add to fridge.");
    } finally {
      setLoading(false);
    }
  };

  const header = data?.list?.name ?? "Shopping List";

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={addSelected} disabled={loading}>
          <Text style={styles.primaryText}>Add to fridge</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Known items from: {header}</Text>
      <Text style={styles.subtitle}>
        Select products that already exist (known/historical). You can also continue without selecting any.
      </Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.smallBtn} onPress={selectAll}>
              <Text style={styles.smallBtnText}>Select all</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.smallBtn} onPress={clearAll}>
              <Text style={styles.smallBtnText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.smallBtn} onPress={goCustom}>
              <Text style={styles.smallBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {!knownItems.length ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No known items on this list.</Text>
              <TouchableOpacity style={styles.primaryBtn2} onPress={goCustom}>
                <Text style={styles.primaryText2}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            knownItems.map((it) => {
              const checked = !!selected[it.id];
              return (
                <TouchableOpacity key={String(it.id)} style={styles.itemRow} onPress={() => toggle(it.id)}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      Store: {it.store_name ?? "No store"} • Qty: {it.quantity}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#663399", padding: 16, paddingTop: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  backBtn: { backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  backText: { color: "#663399", fontWeight: "900" },

  primaryBtn: { backgroundColor: "#ffcc00", padding: 10, borderRadius: 10 },
  primaryText: { color: "#333", fontWeight: "900" },

  title: { marginTop: 14, color: "white", fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 6, color: "white", opacity: 0.9 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 10, flexWrap: "wrap" },
  smallBtn: { backgroundColor: "#fff", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  smallBtnText: { color: "#663399", fontWeight: "900" },

  itemRow: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#663399" },
  checkboxOn: { backgroundColor: "#ffcc00", borderColor: "#ffcc00" },
  itemName: { fontWeight: "900", color: "#333" },
  itemMeta: { marginTop: 4, color: "#666", fontSize: 12 },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 12 },
  emptyText: { fontWeight: "900", color: "#333" },

  primaryBtn2: { marginTop: 10, backgroundColor: "#663399", padding: 10, borderRadius: 10, alignItems: "center" },
  primaryText2: { color: "#fff", fontWeight: "900" },
});