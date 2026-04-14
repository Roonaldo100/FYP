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

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontSize,
  fontWeight,
  spacing,
  type AppColors,
} from "../styles/tokens";

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

  const { colors, commonStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  const onDone = async () => {
    const ok = await deleteList();
    if (!ok || !userId) return;

    router.replace({
      pathname: "/(tabs)/shopping",
      params: { user_id: String(userId) },
    });
  };

  return (
    <View style={commonStyles.screenPrimary}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.primary]}
          onPress={onDone}
          disabled={loading}
        >
          <Text style={buttonStyles.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Custom items</Text>
      <Text style={styles.subtitle}>
        These items are not linked to known products yet. Tap one to create a product from it.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!customItems.length ? (
            <View style={[commonStyles.card, styles.card]}>
              <Text style={styles.emptyText}>No custom items remaining.</Text>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.primary, styles.doneBtn2]}
                onPress={onDone}
              >
                <Text style={buttonStyles.primaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            customItems.map((it) => (
              <TouchableOpacity
                key={String(it.id)}
                style={[commonStyles.card, styles.itemRow]}
                onPress={() => openManualCreate(it)}
              >
                <View style={styles.itemMain}>
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

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backText: {
      color: colors.primary,
      fontWeight: fontWeight.black,
    },
    title: {
      marginTop: spacing.lg,
      color: colors.primaryTextOn,
      fontSize: 20,
      fontWeight: fontWeight.black,
    },
    subtitle: {
      marginTop: spacing.sm,
      color: colors.primaryTextOn,
      opacity: 0.9,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    itemRow: {
      marginBottom: spacing.md,
    },
    itemMain: {
      flex: 1,
    },
    itemName: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    itemMeta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    card: {
      marginTop: spacing.lg,
    },
    emptyText: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    doneBtn2: {
      marginTop: spacing.md,
    },
  });
}