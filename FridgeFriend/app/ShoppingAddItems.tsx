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

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  type AppColors,
} from "../styles/tokens";

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Store = { id: number; name: string };

type InvCandidate = {
  product_id: number;
  product_name: string;
  suggested_store_id: number | null;
  suggested_store_name: string | null;
  qty_in_inventory: number;
};

type HistCandidate = {
  product_id: number;
  product_name: string;
  suggested_store_id: number | null;
  suggested_store_name: string | null;
  suggested_price: number | null;
};

type ProductHit = { id: number; name: string };

export default function ShoppingAddItems() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const { colors, commonStyles, formStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
  const [rowQtyByKey, setRowQtyByKey] = useState<Record<string, string>>({});

  const candidateKey = useCallback((productId: number, storeId: number | null) => {
    return `${productId}:${storeId ?? "null"}`;
  }, []);

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

      const invRows: InvCandidate[] = Array.isArray(inv) ? inv : [];
      const histRows: HistCandidate[] = Array.isArray(hist) ? hist : [];

      const inventoryKeys = new Set(
        invRows.map((x) =>
          candidateKey(Number(x.product_id), x.suggested_store_id ?? null)
        )
      );

      const filteredHistory = histRows.filter(
        (x) =>
          !inventoryKeys.has(
            candidateKey(Number(x.product_id), x.suggested_store_id ?? null)
          )
      );

      setInventory(invRows);
      setHistory(filteredHistory);
    } catch (e) {
      console.warn(e);
      setInventory([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userId, candidateKey]);

  useEffect(() => {
    loadStores();
    loadCandidates();
  }, [loadStores, loadCandidates]);

  const defaultQty = useMemo(() => {
    const n = Number(defaultQtyText);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return 1;
    return n;
  }, [defaultQtyText]);

  const getRowQty = useCallback(
    (productId: number, storeId: number | null) => {
      const key = candidateKey(productId, storeId);
      const raw = rowQtyByKey[key];

      if (raw == null || raw.trim() === "") return defaultQty;

      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return defaultQty;
      return n;
    },
    [candidateKey, rowQtyByKey, defaultQty]
  );

  const setRowQtyText = useCallback(
    (productId: number, storeId: number | null, value: string) => {
      const key = candidateKey(productId, storeId);
      setRowQtyByKey((prev) => ({
        ...prev,
        [key]: value.replace(/[^0-9]/g, ""),
      }));
    },
    [candidateKey]
  );

  const stepRowQty = useCallback(
    (productId: number, storeId: number | null, delta: number) => {
      const current = getRowQty(productId, storeId);
      const next = Math.max(1, current + delta);
      const key = candidateKey(productId, storeId);
      setRowQtyByKey((prev) => ({ ...prev, [key]: String(next) }));
    },
    [candidateKey, getRowQty]
  );

  const addItem = useCallback(
    async ({
      productId,
      customName,
      storeId,
      quantity,
    }: {
      productId?: number;
      customName?: string;
      storeId: number | null;
      quantity: number;
    }) => {
      if (!userId || !listId) return false;

      try {
        const res = await fetch(
          `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: productId ?? null,
              customName: customName ?? null,
              storeId,
              quantity,
            }),
          }
        );

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          Alert.alert("Error", data?.message || "Could not add item.");
          return false;
        }

        return true;
      } catch (e) {
        console.warn(e);
        Alert.alert("Error", "Could not add item.");
        return false;
      }
    },
    [userId, listId]
  );

  const addProduct = async (productId: number) => {
    const ok = await addItem({
      productId,
      storeId: selectedStoreId,
      quantity: defaultQty,
    });

    if (ok) {
      Alert.alert("Added", "Item added to list.");
    }
  };

  const addInventoryProduct = async (it: InvCandidate) => {
    const quantity = getRowQty(it.product_id, it.suggested_store_id ?? null);
    const effectiveStoreId =
      selectedStoreId !== null ? selectedStoreId : (it.suggested_store_id ?? null);

    const ok = await addItem({
      productId: it.product_id,
      storeId: effectiveStoreId,
      quantity,
    });

    if (ok) {
      Alert.alert("Added", "Item added to list.");
    }
  };

  const addHistoryProduct = async (h: HistCandidate) => {
    const quantity = getRowQty(h.product_id, h.suggested_store_id ?? null);
    const effectiveStoreId =
      selectedStoreId !== null ? selectedStoreId : (h.suggested_store_id ?? null);

    const ok = await addItem({
      productId: h.product_id,
      storeId: effectiveStoreId,
      quantity,
    });

    if (ok) {
      Alert.alert("Added", "Item added to list.");
    }
  };

  const addCustom = async () => {
    const name = customName.trim();
    if (!name) {
      Alert.alert("Missing item", "Enter an item name.");
      return;
    }

    const ok = await addItem({
      customName: name,
      storeId: selectedStoreId,
      quantity: defaultQty,
    });

    if (ok) {
      setCustomName("");
      Alert.alert("Added", "Item added to list.");
    }
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
          `${API_BASE_URL}/products/search?q=${encodeURIComponent(
            trimmed
          )}&userId=${encodeURIComponent(String(userId))}&limit=25&offset=0`
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
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.primary, styles.topButton]}
          onPress={() =>
            router.replace({
              pathname: "/ShoppingListDetail",
              params: { user_id: String(userId), listId: String(listId) },
            })
          }
        >
          <Text style={buttonStyles.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Add items</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.cardTitle}>Store for adds (optional override)</Text>

          <TouchableOpacity
            style={[
              styles.storeChip,
              selectedStoreId === null && styles.storeChipSelected,
            ]}
            onPress={() => setSelectedStoreId(null)}
          >
            <Text style={styles.storeChipText}>Use item/default store</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeScroll}>
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

          <Text style={[styles.cardTitle, styles.subTitle]}>Default quantity</Text>
          <TextInput
            value={defaultQtyText}
            onChangeText={setDefaultQtyText}
            keyboardType="number-pad"
            style={[formStyles.inputAlt, styles.input]}
            placeholder="1"
            placeholderTextColor={colors.textLight}
          />
          <Text style={styles.helpText}>
            Used for search and custom adds. Inventory and history rows can set their own quantity below.
          </Text>
        </View>

        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.cardTitle}>Add new item (no product needed)</Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Toothpaste"
            placeholderTextColor={colors.textLight}
            style={[formStyles.inputAlt, styles.input]}
          />
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.primary, styles.primaryBtn]}
            onPress={addCustom}
          >
            <Text style={buttonStyles.primaryText}>Add to list</Text>
          </TouchableOpacity>
        </View>

        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.cardTitle}>Search products (optional)</Text>
          <TextInput
            value={searchText}
            onChangeText={doSearch}
            placeholder="Search products..."
            placeholderTextColor={colors.textLight}
            style={[formStyles.inputAlt, styles.input]}
            autoCapitalize="none"
          />
          {searchLoading ? <ActivityIndicator color={colors.primaryTextOn} /> : null}
          {!!searchHits.length && (
            <View style={styles.searchResults}>
              {searchHits.slice(0, 12).map((p) => (
                <TouchableOpacity
                  key={String(p.id)}
                  style={styles.row}
                  onPress={() => addProduct(p.id)}
                >
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowAction}>Add {defaultQty}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.cardTitle}>Pick from inventory</Text>
          {loading ? (
            <ActivityIndicator color={colors.primaryTextOn} />
          ) : inventory.length ? (
            inventory.slice(0, 60).map((it) => {
              const key = candidateKey(it.product_id, it.suggested_store_id ?? null);
              const qty = getRowQty(it.product_id, it.suggested_store_id ?? null);

              return (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowTitle}>{it.product_name}</Text>
                  <Text style={styles.rowMeta}>
                    Store: {it.suggested_store_name ?? "No store"} • In fridge: {it.qty_in_inventory}
                  </Text>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => stepRowQty(it.product_id, it.suggested_store_id ?? null, -1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>

                    <TextInput
                      value={rowQtyByKey[key] ?? String(qty)}
                      onChangeText={(value) =>
                        setRowQtyText(it.product_id, it.suggested_store_id ?? null, value)
                      }
                      keyboardType="number-pad"
                      placeholderTextColor={colors.textLight}
                      style={styles.qtyInput}
                    />

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => stepRowQty(it.product_id, it.suggested_store_id ?? null, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[buttonStyles.base, buttonStyles.primary, styles.inlineAddBtn]}
                      onPress={() => addInventoryProduct(it)}
                    >
                      <Text style={buttonStyles.primaryText}>Add {qty}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>No inventory items.</Text>
          )}
        </View>

        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.cardTitle}>Pick from history</Text>
          {loading ? (
            <ActivityIndicator color={colors.primaryTextOn} />
          ) : history.length ? (
            history.slice(0, 80).map((it) => {
              const key = candidateKey(it.product_id, it.suggested_store_id ?? null);
              const qty = getRowQty(it.product_id, it.suggested_store_id ?? null);

              return (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowTitle}>{it.product_name}</Text>
                  <Text style={styles.rowMeta}>
                    Last: {it.suggested_store_name ?? "No store"}
                    {it.suggested_price != null
                      ? ` • €${Number(it.suggested_price).toFixed(2)}`
                      : ""}
                  </Text>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => stepRowQty(it.product_id, it.suggested_store_id ?? null, -1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>

                    <TextInput
                      value={rowQtyByKey[key] ?? String(qty)}
                      onChangeText={(value) =>
                        setRowQtyText(it.product_id, it.suggested_store_id ?? null, value)
                      }
                      keyboardType="number-pad"
                      placeholderTextColor={colors.textLight}
                      style={styles.qtyInput}
                    />

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => stepRowQty(it.product_id, it.suggested_store_id ?? null, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[buttonStyles.base, buttonStyles.primary, styles.inlineAddBtn]}
                      onPress={() => addHistoryProduct(it)}
                    >
                      <Text style={buttonStyles.primaryText}>Add {qty}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>No historical items.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      padding: spacing.xl,
      paddingTop: 18,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
    },
    topButton: {
      paddingHorizontal: spacing.lg,
    },
    backText: {
      color: colors.primary,
      fontWeight: fontWeight.heavy,
    },
    title: {
      marginTop: spacing.lg,
      color: colors.primaryTextOn,
      fontSize: 22,
      fontWeight: fontWeight.heavy,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    card: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    cardTitle: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    subTitle: {
      marginTop: spacing.lg,
    },
    input: {
      marginTop: spacing.sm,
      marginBottom: 0,
    },
    helpText: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    primaryBtn: {
      marginTop: spacing.md,
    },
    storeScroll: {
      marginTop: spacing.sm,
    },
    storeChip: {
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
    },
    storeChipSelected: {
      backgroundColor: colors.accent,
    },
    storeChipText: {
      fontWeight: fontWeight.heavy,
      color: colors.text,
    },
    searchResults: {
      marginTop: spacing.md,
    },
    row: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    rowTitle: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    rowMeta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    rowAction: {
      marginTop: spacing.sm,
      fontWeight: fontWeight.black,
      color: colors.primary,
    },
    qtyRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    qtyBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyBtnText: {
      fontSize: 18,
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    qtyInput: {
      minWidth: 52,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      textAlign: "center",
      backgroundColor: colors.surface,
      color: colors.text,
    },
    inlineAddBtn: {
      borderRadius: radius.sm,
      paddingVertical: 9,
      paddingHorizontal: spacing.lg,
    },
    empty: {
      marginTop: spacing.md,
      color: colors.textMuted,
    },
  });
}