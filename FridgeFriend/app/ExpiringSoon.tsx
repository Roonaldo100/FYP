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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [items, setItems] = useState<ExpiringSoonRow[]>([]);
  const [removeQtyByKey, setRemoveQtyByKey] = useState<Record<string, number>>({});

  const getItemKey = useCallback((it: ExpiringSoonRow) => {
    return `${it.product_id}-${it.store_id ?? "null"}-${it.nearest_expiry}`;
  }, []);

  const clampRemoveQty = useCallback((qty: number, max: number) => {
    if (!Number.isFinite(qty)) return 1;
    return Math.max(1, Math.min(Math.trunc(qty), Math.max(1, max)));
  }, []);

  const getSelectedRemoveQty = useCallback(
    (it: ExpiringSoonRow) => {
      const key = getItemKey(it);
      return clampRemoveQty(removeQtyByKey[key] ?? 1, it.quantity);
    },
    [getItemKey, clampRemoveQty, removeQtyByKey]
  );

  const setSelectedRemoveQty = useCallback(
    (it: ExpiringSoonRow, nextQty: number) => {
      const key = getItemKey(it);
      const clamped = clampRemoveQty(nextQty, it.quantity);
      setRemoveQtyByKey((prev) => ({ ...prev, [key]: clamped }));
    },
    [getItemKey, clampRemoveQty]
  );

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/expiringSoon`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("expiringSoon fetch failed:", res.status, txt);
        throw new Error("Fetch failed");
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setItems(rows);

      setRemoveQtyByKey((prev) => {
        const next: Record<string, number> = {};
        for (const row of rows) {
          const key = getItemKey(row);
          next[key] = clampRemoveQty(prev[key] ?? 1, row.quantity);
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load expiring soon items.");
      setItems([]);
      setRemoveQtyByKey({});
    } finally {
      setLoading(false);
    }
  }, [userId, getItemKey, clampRemoveQty]);

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

  const removeQuantity = async (it: ExpiringSoonRow) => {
    if (!userId) return;

    const selectedQty = getSelectedRemoveQty(it);
    const key = getItemKey(it);
    const removeAll = selectedQty >= it.quantity;

    Alert.alert(
      removeAll ? "Remove all items?" : "Remove items?",
      removeAll
        ? `Remove all ${it.quantity} "${it.product_name}" from the bucket expiring on ${it.nearest_expiry}?`
        : `Remove ${selectedQty} "${it.product_name}" from the bucket expiring on ${it.nearest_expiry}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: removeAll ? "Remove all" : `Remove ${selectedQty}`,
          style: "destructive",
          onPress: async () => {
            try {
              setBusyKey(key);

              const resp = await fetch(`${API_BASE_URL}/user_products/removeByExpiry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId,
                  productId: it.product_id,
                  storeId: it.store_id,
                  expiryDate: it.nearest_expiry,
                  quantity: selectedQty,
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
              Alert.alert("Error", "Could not remove item(s).");
            } finally {
              setBusyKey(null);
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
        <ActivityIndicator size="large" color="#fff" />
      ) : !items.length ? (
        <Text style={styles.empty}>No items expiring within your notification windows.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => getItemKey(it)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const key = getItemKey(item);
            const selectedQty = getSelectedRemoveQty(item);
            const isBusy = busyKey === key;
            const canDecrease = selectedQty > 1 && !isBusy;
            const canIncrease = selectedQty < item.quantity && !isBusy;

            return (
              <View style={styles.card}>
                <TouchableOpacity
                  onPress={() => openProduct(item)}
                  activeOpacity={0.85}
                  style={styles.cardMain}
                  disabled={isBusy}
                >
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

                <View style={styles.controlsColumn}>
                  <Text style={styles.removeLabel}>Remove</Text>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, !canDecrease && styles.disabledBtn]}
                      onPress={() => setSelectedRemoveQty(item, selectedQty - 1)}
                      disabled={!canDecrease}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.qtyValue}>{selectedQty}</Text>

                    <TouchableOpacity
                      style={[styles.qtyBtn, !canIncrease && styles.disabledBtn]}
                      onPress={() => setSelectedRemoveQty(item, selectedQty + 1)}
                      disabled={!canIncrease}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.removeBtn, isBusy && styles.disabledRemoveBtn]}
                    onPress={() => removeQuantity(item)}
                    disabled={isBusy}
                  >
                    <Text style={styles.removeText}>
                      {isBusy
                        ? "Removing..."
                        : selectedQty >= item.quantity
                        ? "Remove all"
                        : `Remove ${selectedQty}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#663399",
    padding: 16,
    paddingTop: 40,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  backBtn: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backText: {
    color: "#663399",
    fontWeight: "900",
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },
  empty: {
    color: "white",
    marginTop: 10,
    opacity: 0.9,
  },
  listContent: {
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardMain: {
    flex: 1,
  },
  name: {
    fontWeight: "900",
    color: "#333",
    fontSize: 16,
  },
  meta: {
    marginTop: 6,
    color: "#666",
    fontSize: 12,
  },
  tapHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#663399",
  },

  controlsColumn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
  },
  removeLabel: {
    color: "#333",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  qtyBtn: {
    backgroundColor: "#e7def5",
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    color: "#663399",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  qtyValue: {
    minWidth: 24,
    textAlign: "center",
    color: "#333",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledBtn: {
    opacity: 0.45,
  },

  removeBtn: {
    backgroundColor: "#b00020",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 92,
    alignItems: "center",
  },
  disabledRemoveBtn: {
    opacity: 0.6,
  },
  removeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
});