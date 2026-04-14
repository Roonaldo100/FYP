import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
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

  const { colors, commonStyles, buttonStyles, formStyles, modalStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeModalItem, setStoreModalItem] = useState<Item | null>(null);

  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyModalItem, setQtyModalItem] = useState<Item | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [qtySaving, setQtySaving] = useState(false);

  function parsePositiveInt(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  const openQtyModal = (item: Item) => {
    setQtyModalItem(item);
    setQtyInput(String(item.quantity));
    setQtyModalOpen(true);
  };

  const closeQtyModal = () => {
    if (qtySaving) return;
    setQtyModalOpen(false);
    setQtyModalItem(null);
    setQtyInput("");
  };

  const load = useCallback(async () => {
    if (!userId || !listId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}`
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
        `${API_BASE_URL}/stores?userId=${encodeURIComponent(String(userId))}`
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setStores(
        Array.isArray(d)
          ? d.map((s: any) => ({ id: Number(s.id), name: String(s.name) }))
          : []
      );
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
    }, [load, loadStores])
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
        { method: "DELETE" }
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
        }
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
        }
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

  const saveItemQuantity = async () => {
    if (!userId || !listId || !qtyModalItem) return;

    const parsed = parsePositiveInt(qtyInput);
    if (parsed === null) {
      Alert.alert("Invalid quantity", "Enter a whole number greater than 0.");
      return;
    }

    try {
      setQtySaving(true);

      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${qtyModalItem.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: parsed }),
        }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      setQtyModalOpen(false);
      setQtyModalItem(null);
      setQtyInput("");
      await load();
    } catch (e) {
      console.warn("save quantity error:", e);
      Alert.alert("Error", "Could not update quantity.");
    } finally {
      setQtySaving(false);
    }
  };

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
        }
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
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.primary, styles.topButton]}
          onPress={goAddItems}
        >
          <Text style={buttonStyles.primaryText}>+ Add items</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{header}</Text>

      {loading && <ActivityIndicator color={colors.primaryTextOn} />}

      {!loading && data && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[commonStyles.card, styles.summary]}>
            <Text style={styles.summaryLine}>
              Total (known prices): €{Number(data.total_known_price || 0).toFixed(2)}
            </Text>
            <Text style={styles.summaryLine}>
              Unknown price items: {Number(data.unknown_price_count || 0)}
            </Text>
          </View>

          {data.groups.map((g, idx) => (
            <View
              key={`${String(g.store_id)}-${idx}`}
              style={[commonStyles.card, styles.groupCard]}
            >
              <Text style={styles.groupTitle}>{g.store_name}</Text>
              <Text style={styles.groupMeta}>
                Subtotal known: €{Number(g.subtotal_known || 0).toFixed(2)} • Unknown:{" "}
                {Number(g.unknown_count || 0)}
              </Text>

              {g.items.map((it) => (
                <View key={String(it.id)} style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{it.name}</Text>

                    <TouchableOpacity
                      style={styles.qtyTap}
                      onPress={() => openQtyModal(it)}
                    >
                      <Text style={styles.itemMeta}>
                        Qty: {it.quantity}{" "}
                        {it.unit_price != null
                          ? `• €${Number(it.unit_price).toFixed(2)} each`
                          : "• price unknown"}
                        {it.line_total != null
                          ? ` • line €${Number(it.line_total).toFixed(2)}`
                          : ""}
                      </Text>
                      <Text style={styles.qtyHint}>Tap to set exact quantity</Text>
                    </TouchableOpacity>

                    <View style={styles.storeRow}>
                      <Text style={styles.storeLabel}>
                        Store: {it.store_name ?? "No store"}
                      </Text>
                      <TouchableOpacity
                        style={[buttonStyles.base, buttonStyles.secondary, styles.changeStoreBtn]}
                        onPress={() => openStoreModal(it)}
                      >
                        <Text style={buttonStyles.secondaryText}>Change store</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.qtyCol}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, it.quantity <= 1 && styles.dimmed]}
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
                      style={[buttonStyles.base, buttonStyles.danger, styles.removeBtn]}
                      onPress={() => removeItem(it.id)}
                    >
                      <Text style={buttonStyles.dangerText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.primary, styles.bottomAddBtn]}
        onPress={() =>
          router.push({
            pathname: "/ShoppingListAddKnownToFridge",
            params: { user_id: String(userId), listId: String(listId) },
          })
        }
      >
        <Text style={buttonStyles.primaryText}>Add to fridge</Text>
      </TouchableOpacity>

      <Modal
        visible={storeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeStoreModal}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Select store</Text>

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

            <View style={styles.modalSpacer} />

            <ScrollView style={styles.modalScroll}>
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

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, styles.modalClose]}
              onPress={closeStoreModal}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={qtyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeQtyModal}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Set quantity</Text>

            <Text style={styles.modalSub}>
              Item: {qtyModalItem?.name ?? "—"}
            </Text>

            <TextInput
              value={qtyInput}
              onChangeText={(v) => setQtyInput(v.replace(/[^0-9]/g, ""))}
              placeholder="Enter quantity"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              style={[formStyles.inputAlt, styles.modalInput]}
              editable={!qtySaving}
            />

            <TouchableOpacity
              style={[
                buttonStyles.base,
                buttonStyles.accent,
                qtySaving && styles.dimmed,
              ]}
              onPress={saveItemQuantity}
              disabled={qtySaving}
            >
              <Text style={buttonStyles.accentText}>
                {qtySaving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                buttonStyles.base,
                buttonStyles.primary,
                styles.modalClose,
                qtySaving && styles.dimmed,
              ]}
              onPress={closeQtyModal}
              disabled={qtySaving}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
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
      fontWeight: fontWeight.black,
    },
    title: {
      marginTop: spacing.lg,
      color: colors.text,
      fontSize: 22,
      fontWeight: fontWeight.black,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    summary: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    summaryLine: {
      color: colors.text,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.xs,
    },
    groupCard: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    groupTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
    },
    groupMeta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    itemRow: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "flex-start",
    },
    itemMain: {
      flex: 1,
    },
    itemName: {
      color: colors.text,
      fontWeight: fontWeight.black,
      fontSize: fontSize.md,
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    qtyTap: {
      marginTop: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    qtyHint: {
      marginTop: spacing.xs,
      color: colors.primary,
      fontWeight: fontWeight.heavy,
      fontSize: fontSize.xs,
    },
    storeRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      flexWrap: "wrap",
    },
    storeLabel: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
    changeStoreBtn: {
      alignSelf: "flex-start",
    },
    qtyCol: {
      alignItems: "center",
      gap: spacing.sm,
    },
    qtyBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyBtnText: {
      color: colors.text,
      fontSize: 20,
      fontWeight: fontWeight.black,
      lineHeight: 22,
    },
    removeBtn: {
      minWidth: 88,
      alignItems: "center",
    },
    bottomAddBtn: {
      marginTop: spacing.lg,
    },
    modalSub: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontWeight: fontWeight.bold,
    },
    modalRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalRowText: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
    modalSpacer: {
      height: 12,
    },
    modalScroll: {
      maxHeight: 320,
    },
    modalEmpty: {
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    modalInput: {
      marginTop: spacing.lg,
      marginBottom: 0,
    },
    modalClose: {
      marginTop: spacing.lg,
    },
    dimmed: {
      opacity: 0.6,
    },
  });
}