import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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

type Group = { store_id: number | null; store_name: string; items: Item[] };

type DetailResponse = { list: { id: number; name: string }; groups: Group[] };

export default function ShoppingListCustomItems() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);

  const customItems = useMemo(() => {
    const out: Item[] = [];
    for (const g of data?.groups || []) {
      for (const it of g.items || []) {
        if (!it.product_id && it.custom_name) out.push(it);
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
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load list.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, listId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openManualCreate = (it: Item) => {
    if (!userId || !listId || !it.custom_name) return;

    router.push({
      pathname: "/ManualAddProduct",
      params: {
        user_id: String(userId),
        prefill_name: String(it.custom_name),
        prefill_store_id: it.store_id === null ? "" : String(it.store_id),
        prefill_store_name: it.store_name ?? "No store",
        from_shopping_list: "1",
        listId: String(listId),
        itemId: String(it.id),
        prefill_quantity: String(it.quantity ?? 1),
      },
    });
  };

  const deleteList = async () => {
    if (!userId || !listId) return false;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${listId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not delete shopping list.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const goBackToShoppingTab = () => {
    if (!userId) return;
    router.replace({
      pathname: "/(tabs)/shopping",
      params: { user_id: String(userId) },
    });
  };

  const onDone = () => {
    Alert.alert("Delete shopping list?", "Would you like to delete this shopping list now?", [
      { text: "No", style: "cancel", onPress: goBackToShoppingTab },
      {
        text: "Yes (delete)",
        style: "destructive",
        onPress: async () => {
          const ok = await deleteList();
          if (ok) goBackToShoppingTab();
        },
      },
    ]);
  };

  const header = data?.list?.name ?? "Shopping List";

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneBtn} onPress={onDone} disabled={loading}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Custom items from: {header}</Text>
      <Text style={styles.subtitle}>
        Tap any item below to create a product for it (this creates historical data). When created,
        the item quantity will be added to your fridge automatically.
      </Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {!customItems.length ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No custom items remaining.</Text>
              <TouchableOpacity style={styles.doneBtn2} onPress={onDone}>
                <Text style={styles.doneText2}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            customItems.map((it) => (
              <TouchableOpacity
                key={String(it.id)}
                style={styles.itemRow}
                onPress={() => openManualCreate(it)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{String(it.custom_name)}</Text>
                  <Text style={styles.itemMeta}>
                    Store: {it.store_name ?? "No store"} • Qty: {it.quantity}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
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

  doneBtn: { backgroundColor: "#ffcc00", padding: 10, borderRadius: 10 },
  doneText: { color: "#333", fontWeight: "900" },

  title: { marginTop: 14, color: "white", fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 6, color: "white", opacity: 0.9 },

  itemRow: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 },
  itemName: { fontWeight: "900", color: "#333" },
  itemMeta: { marginTop: 4, color: "#666", fontSize: 12 },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 12 },
  emptyText: { fontWeight: "900", color: "#333" },

  doneBtn2: { marginTop: 10, backgroundColor: "#663399", padding: 10, borderRadius: 10, alignItems: "center" },
  doneText2: { color: "#fff", fontWeight: "900" },
});