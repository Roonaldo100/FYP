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

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  type AppColors,
} from "../styles/tokens";

import { formatDisplayDate } from "../lib/dateUtils";

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

function normalizeExpiryForApi(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export default function ExpiringSoon() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const { colors, commonStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [items, setItems] = useState<ExpiringSoonRow[]>([]);
  const [removeQtyByKey, setRemoveQtyByKey] = useState<Record<string, number>>({});

  const getExpiry = useCallback((it: ExpiringSoonRow) => {
    return normalizeExpiryForApi(it.nearest_expiry);
  }, []);

  const getItemKey = useCallback(
    (it: ExpiringSoonRow) => {
      return `${it.product_id}-${it.store_id ?? "null"}-${getExpiry(it) ?? "null"}`;
    },
    [getExpiry]
  );

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
      const rows = (Array.isArray(data) ? data : []).map((row) => ({
        ...row,
        nearest_expiry: normalizeExpiryForApi(row?.nearest_expiry) ?? "",
      }));

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
    const expiry = getExpiry(it);

    Alert.alert(
      removeAll ? "Remove all items?" : "Remove items?",
      removeAll
        ? `Remove all ${it.quantity} "${it.product_name}" from the bucket expiring on ${expiry ?? "No expiry date"}?`
        : `Remove ${selectedQty} "${it.product_name}" from the bucket expiring on ${expiry ?? "No expiry date"}?`,
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
                  expiryDate: expiry,
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
    <View style={commonStyles.screenPrimary}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light]}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Expiring soon</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : !items.length ? (
        <Text style={styles.empty}>
          No items expiring within your notification windows.
        </Text>
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
            const expiry = getExpiry(item);

            return (
              <View style={[commonStyles.card, styles.card]}>
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
                    Expires: {expiry ? formatDisplayDate(expiry) : "No expiry date"} • In {item.days_left} day(s) • Window:{" "}
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
                    style={[
                      buttonStyles.base,
                      buttonStyles.danger,
                      styles.removeBtn,
                      isBusy && styles.disabledRemoveBtn,
                    ]}
                    onPress={() => removeQuantity(item)}
                    disabled={isBusy}
                  >
                    <Text style={buttonStyles.dangerText}>
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

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    backText: {
      color: colors.primary,
      fontWeight: fontWeight.black,
    },
    title: {
      color: colors.primaryTextOn,
      fontSize: 20,
      fontWeight: fontWeight.black,
    },
    empty: {
      color: colors.primaryTextOn,
      marginTop: spacing.md,
      opacity: 0.9,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    card: {
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    cardMain: {
      flex: 1,
    },
    name: {
      fontWeight: fontWeight.black,
      color: colors.text,
      fontSize: fontSize.md,
    },
    meta: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    tapHint: {
      marginTop: spacing.sm,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
    controlsColumn: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 110,
    },
    removeLabel: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.sm,
    },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    qtyBtn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyBtnText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: fontWeight.black,
      lineHeight: 20,
    },
    qtyValue: {
      minWidth: 24,
      textAlign: "center",
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
    },
    disabledBtn: {
      opacity: 0.45,
    },
    removeBtn: {
      minWidth: 92,
      alignItems: "center",
    },
    disabledRemoveBtn: {
      opacity: 0.6,
    },
  });
}