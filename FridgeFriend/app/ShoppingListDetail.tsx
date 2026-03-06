import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
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

type Store = { id: number; name: string };

type Item = {
  id: number;
  name: string;
  product_id: number | null;
  custom_name: string | null;
  store_id: number | null;
  store_name: string | null;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

type Group = {
  store_id: number | null;
  store_name: string;
  items: Item[];
  subtotal_known: number;
  unknown_count: number;
};

type DetailResponse = {
  list: { id: number; name: string; created_at?: string; updated_at?: string };
  groups: Group[];
  total_known_price: number;
  unknown_price_count: number;
};

export default function ShoppingListDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);

  // Stores for store-picker
  const [stores, setStores] = useState<Store[]>([]);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeModalItem, setStoreModalItem] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!userId || !listId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}`,
      );
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

  const loadStores = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/stores?userId=${encodeURIComponent(String(userId))}`,
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setStores(Array.isArray(d) ? d.map((s: any) => ({ id: Number(s.id), name: String(s.name) })) : []);
    } catch (e) {
      console.warn("loadStores error:", e);
      setStores([]);
    }
  }, [userId]);

  useEffect(() => {
    load();
    loadStores();
  }, [load, loadStores]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadStores();
    }, [load, loadStores]),
  );

  const goAddItems = () => {
    if (!userId || !listId) return;
    router.push({
      pathname: "/ShoppingAddItems",
      params: { user_id: String(userId), listId: String(listId) },
    });
  };

  const removeItem = async (itemId: number) => {
    if (!userId || !listId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not remove item.");
    } finally {
      setLoading(false);
    }
  };

  const incQty = async (itemId: number, currentQty: number) => {
    if (!userId || !listId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: currentQty + 1 }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not update quantity.");
    } finally {
      setLoading(false);
    }
  };

  const decQty = async (itemId: number, currentQty: number) => {
    if (!userId || !listId) return;
    if (currentQty <= 1) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: currentQty - 1 }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not update quantity.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Store editing ----
  const openStoreModal = (item: Item) => {
    setStoreModalItem(item);
    setStoreModalOpen(true);
  };

  const closeStoreModal = () => {
    setStoreModalOpen(false);
    setStoreModalItem(null);
  };

  const setItemStore = async (itemId: number, newStoreId: number | null) => {
    if (!userId || !listId) return;

    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: newStoreId }),
        },
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      closeStoreModal();
      await load();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not update store.");
    } finally {
      setLoading(false);
    }
  };

  const header = data?.list?.name ?? "Shopping List";

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={goAddItems}>
          <Text style={styles.addText}>+ Add items</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{header}</Text>

      {loading && <ActivityIndicator />}

      {!loading && data && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.summary}>
            <Text style={styles.summaryLine}>
              Total (known prices): €
              {Number(data.total_known_price || 0).toFixed(2)}
            </Text>
            <Text style={styles.summaryLine}>
              Unknown price items: {Number(data.unknown_price_count || 0)}
            </Text>
          </View>

          {data.groups.map((g, idx) => (
            <View key={`${String(g.store_id)}-${idx}`} style={styles.groupCard}>
              <Text style={styles.groupTitle}>{g.store_name}</Text>
              <Text style={styles.groupMeta}>
                Subtotal known: €
                {Number(g.subtotal_known || 0).toFixed(2)} • Unknown:{" "}
                {Number(g.unknown_count || 0)}
              </Text>

              {g.items.map((it) => (
                <View key={String(it.id)} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      Qty: {it.quantity}{" "}
                      {it.unit_price != null
                        ? `• €${Number(it.unit_price).toFixed(2)} each`
                        : "• price unknown"}
                      {it.line_total != null
                        ? ` • line €${Number(it.line_total).toFixed(2)}`
                        : ""}
                    </Text>

                    <View style={styles.storeRow}>
                      <Text style={styles.storeLabel}>
                        Store: {it.store_name ?? "No store"}
                      </Text>
                      <TouchableOpacity
                        style={styles.changeStoreBtn}
                        onPress={() => openStoreModal(it)}
                      >
                        <Text style={styles.changeStoreText}>Change store</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.qtyCol}>
                    <TouchableOpacity
                      style={[
                        styles.qtyBtn,
                        it.quantity <= 1 && { opacity: 0.4 },
                      ]}
                      onPress={() => decQty(it.id, it.quantity)}
                      disabled={it.quantity <= 1}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => incQty(it.id, it.quantity)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeItem(it.id)}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() =>
          router.push({
            pathname: "/ShoppingListAddKnownToFridge",
            params: { user_id: String(userId), listId: String(listId) },
          })
        }
      >
        <Text style={styles.addText}>Add to fridge</Text>
      </TouchableOpacity>

      {/* Store picker modal */}
      <Modal
        visible={storeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeStoreModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select store</Text>

            <Text style={styles.modalSub}>
              Item: {storeModalItem?.name ?? "—"}
            </Text>

            <TouchableOpacity
              style={styles.modalRow}
              onPress={() =>
                storeModalItem && setItemStore(storeModalItem.id, null)
              }
            >
              <Text style={styles.modalRowText}>No store</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />

            <ScrollView style={{ maxHeight: 320 }}>
              {stores.map((s) => (
                <TouchableOpacity
                  key={String(s.id)}
                  style={styles.modalRow}
                  onPress={() =>
                    storeModalItem && setItemStore(storeModalItem.id, s.id)
                  }
                >
                  <Text style={styles.modalRowText}>{s.name}</Text>
                </TouchableOpacity>
              ))}

              {!stores.length && (
                <Text style={styles.modalEmpty}>
                  No stores found. Create one first.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalClose} onPress={closeStoreModal}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 14, paddingTop: 18 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  backBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  backText: { fontWeight: "800" },

  addBtn: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 10,
  },
  addText: { color: "#fff", fontWeight: "800" },

  title: { marginTop: 12, fontSize: 22, fontWeight: "900" },

  summary: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  summaryLine: { fontWeight: "800", marginTop: 4 },

  groupCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  groupTitle: { fontSize: 18, fontWeight: "900" },
  groupMeta: { marginTop: 4, color: "#666" },

  itemRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  itemName: { fontWeight: "900" },
  itemMeta: { marginTop: 4, color: "#666", fontSize: 12 },

  storeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  storeLabel: { color: "#333", fontWeight: "800", fontSize: 12 },
  changeStoreBtn: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  changeStoreText: { fontWeight: "900", fontSize: 12 },

  qtyCol: { alignItems: "flex-end", gap: 6 },
  qtyBtn: { backgroundColor: "#eee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  qtyBtnText: { fontWeight: "900", fontSize: 16 },

  removeBtn: { backgroundColor: "#b00020", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  removeText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },
  modalTitle: { fontWeight: "900", fontSize: 16, marginBottom: 6 },
  modalSub: { color: "#666", marginBottom: 10 },

  modalRow: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  modalRowText: { fontWeight: "900", color: "#111" },
  modalEmpty: { color: "#666", marginTop: 8, marginBottom: 8 },

  modalClose: {
    marginTop: 8,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "900" },
});