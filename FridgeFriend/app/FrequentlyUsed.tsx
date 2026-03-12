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

import { commonStyles } from "../styles/common";
import { buttonStyles } from "../styles/buttons";
import { colors, fontSize, fontWeight, spacing } from "../styles/tokens";

type FrequentRow = {
  product_id: number;
  product_name: string;
  suggested_store_id: number | null;
  suggested_store_name: string | null;
  total_count: number;
  inv_count: number;
  list_count: number;
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
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const getRowKey = useCallback((it: FrequentRow) => {
    return `${it.product_id}:${it.suggested_store_id ?? "ns"}`;
  }, []);

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
        store_id:
          row.suggested_store_id === null ? "" : String(row.suggested_store_id),
        store_name: row.suggested_store_name ?? "",
      },
    });
  };

  const deleteItem = useCallback(
    (row: FrequentRow) => {
      if (!userId) return;

      const rowKey = getRowKey(row);

      Alert.alert(
        "Delete frequently used item?",
        `Remove "${row.product_name}" from Frequently Used?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                setDeletingKey(rowKey);

                const url = `${API_BASE_URL}/user_product_usage?userId=${encodeURIComponent(
                  String(userId)
                )}&productId=${encodeURIComponent(String(row.product_id))}`;

                const res = await fetch(url, {
                  method: "DELETE",
                });

                const data = await res.json().catch(() => null);

                if (!res.ok) {
                  console.error("Delete frequent item failed:", res.status, data);
                  throw new Error(data?.message || "Delete failed");
                }

                await load();
              } catch (e: any) {
                console.error(e);
                Alert.alert(
                  "Error",
                  e?.message || "Could not delete frequently used item."
                );
              } finally {
                setDeletingKey(null);
              }
            },
          },
        ]
      );
    },
    [userId, getRowKey, load]
  );

  return (
    <View style={commonStyles.screenPrimary}>
      <Text style={styles.title}>Frequently Used</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => getRowKey(it)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const rowKey = getRowKey(item);
            const isDeleting = deletingKey === rowKey;

            return (
              <View style={[commonStyles.card, styles.row]}>
                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => onPick(item)}
                  disabled={isDeleting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.name}>{item.product_name}</Text>
                  <Text style={styles.meta}>
                    {item.suggested_store_name
                      ? `Store: ${item.suggested_store_name}`
                      : "No store"}
                    {"  •  "}
                    Used: {item.total_count}
                  </Text>
                  <Text style={styles.subMeta}>
                    Inventory adds: {item.inv_count} {"  •  "}Shopping adds:{" "}
                    {item.list_count}
                  </Text>
                </TouchableOpacity>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.addBtn, isDeleting && styles.disabledBtn]}
                    onPress={() => onPick(item)}
                    disabled={isDeleting}
                  >
                    <Text style={styles.addText}>Add →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      buttonStyles.base,
                      buttonStyles.danger,
                      isDeleting && styles.disabledDeleteBtn,
                    ]}
                    onPress={() => deleteItem(item)}
                    disabled={isDeleting}
                  >
                    <Text style={buttonStyles.dangerText}>
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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
  title: {
    color: colors.primaryTextOn,
    fontSize: 18,
    fontWeight: fontWeight.black,
    marginBottom: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  row: {
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
  },
  name: {
    fontWeight: fontWeight.black,
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xs,
  },
  subMeta: {
    marginTop: spacing.xs,
    color: "#777",
    fontWeight: fontWeight.medium,
    fontSize: 11,
  },
  actions: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  addBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  addText: {
    fontWeight: fontWeight.black,
    color: colors.primary,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  disabledDeleteBtn: {
    opacity: 0.6,
  },
  empty: {
    color: colors.primaryTextOn,
    opacity: 0.9,
    marginTop: spacing.md,
    fontWeight: fontWeight.heavy,
  },
  backBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.primaryTextOn,
    fontWeight: fontWeight.black,
  },
});