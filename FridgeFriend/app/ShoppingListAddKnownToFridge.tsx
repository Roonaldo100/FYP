import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { formatDisplayDate } from "../lib/dateUtils";
import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { modalStyles } from "../styles/modals";
import { colors, fontSize, fontWeight, radius, spacing } from "../styles/tokens";

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
  expiry_date: string | null;
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function makeNextDaysOptions(count: number) {
  const out: { key: string; label: string; value: string | null }[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  out.push({ key: "__none__", label: "No expiry date", value: null });

  for (let i = 0; i < count; i++) {
    const d = addDays(today, i);
    const v = formatDateYYYYMMDD(d);

    const pretty = d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    out.push({ key: v, label: pretty, value: v });
  }

  return out;
}

export default function ShoppingListAddKnownToFridge() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; listId?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editQtyText, setEditQtyText] = useState("1");
  const [editStoreId, setEditStoreId] = useState<number | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);

  const dateOptions = useMemo(() => makeNextDaysOptions(60), []);

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

      setSelected((prev) => {
        const validIds = new Set<number>();
        for (const g of d.groups || []) {
          for (const it of g.items || []) {
            if (it.product_id) validIds.add(Number(it.id));
          }
        }

        const next: Record<number, boolean> = {};
        for (const [k, v] of Object.entries(prev)) {
          const id = Number(k);
          if (validIds.has(id) && v) next[id] = true;
        }
        return next;
      });
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
      setStoresLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/stores?userId=${encodeURIComponent(String(userId))}`
      );
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("loadStores error:", e);
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [userId]);

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

  const openEditModal = async (it: Item) => {
    setEditItem(it);
    setEditQtyText(String(it.quantity));
    setEditStoreId(it.store_id ?? null);
    setEditExpiryDate(it.expiry_date ? String(it.expiry_date).slice(0, 10) : "");
    await loadStores();
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditModalOpen(false);
    setEditItem(null);
    setEditQtyText("1");
    setEditStoreId(null);
    setEditExpiryDate("");
    setExpiryMenuOpen(false);
  };

  const saveEdit = async () => {
    if (!userId || !listId || !editItem) return;

    const qty = Number(editQtyText);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a whole number greater than 0.");
      return;
    }

    if (
      editExpiryDate.trim() &&
      !/^\d{4}-\d{2}-\d{2}$/.test(editExpiryDate.trim())
    ) {
      Alert.alert("Invalid expiry", "Use YYYY-MM-DD or leave blank.");
      return;
    }

    try {
      setSavingEdit(true);

      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${editItem.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: qty,
            storeId: editStoreId,
            expiryDate: editExpiryDate.trim() ? editExpiryDate.trim() : null,
          }),
        }
      );

      const txt = await res.text().catch(() => "");
      let out: any = null;
      try {
        out = JSON.parse(txt);
      } catch {}

      if (!res.ok) {
        Alert.alert("Error", out?.message || "Could not update item.");
        return;
      }

      closeEditModal();
      await load();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not update item.");
    } finally {
      setSavingEdit(false);
    }
  };

  const addSelected = async () => {
    if (!userId || !listId) return;

    const itemIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (!itemIds.length) {
      goCustom();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/addToInventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds }),
        }
      );

      const txt = await res.text().catch(() => "");
      let out: any = null;
      try {
        out = JSON.parse(txt);
      } catch {}

      if (!res.ok) {
        Alert.alert("Error", out?.message || "Could not add to fridge.");
        return;
      }

      Alert.alert(
        "Added",
        `Added ${Number(out?.added_inventory_rows ?? 0)} item(s) to your fridge.`
      );
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
          style={[buttonStyles.base, buttonStyles.accent]}
          onPress={addSelected}
          disabled={loading}
        >
          <Text style={buttonStyles.accentText}>Add to fridge</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Known items from: {header}</Text>
      <Text style={styles.subtitle}>
        Tap to select for quick add. Long press to edit quantity, store, and expiry first.
      </Text>

      {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

      {!loading && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.light]}
              onPress={selectAll}
            >
              <Text style={styles.smallBtnText}>Select all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.light]}
              onPress={clearAll}
            >
              <Text style={styles.smallBtnText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.light]}
              onPress={goCustom}
            >
              <Text style={styles.smallBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {!knownItems.length ? (
            <View style={[commonStyles.card, styles.card]}>
              <Text style={styles.emptyText}>No known items on this list.</Text>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.primary, styles.primaryBtn2]}
                onPress={goCustom}
              >
                <Text style={buttonStyles.primaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            knownItems.map((it) => {
              const checked = !!selected[it.id];
              return (
                <TouchableOpacity
                  key={String(it.id)}
                  style={[commonStyles.card, styles.itemRow]}
                  onPress={() => toggle(it.id)}
                  onLongPress={() => openEditModal(it)}
                  delayLongPress={250}
                  activeOpacity={0.85}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxOn]} />
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      Store: {it.store_name ?? "No store"} • Qty: {it.quantity}
                    </Text>
                    <Text style={styles.itemMeta}>
                      Expiry: {it.expiry_date ? formatDisplayDate(it.expiry_date) : "None"}
                    </Text>
                    <Text style={styles.itemHint}>
                      Long press to edit quantity / store / expiry →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={editModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Edit list item</Text>

            <Text style={styles.modalSub}>Item: {editItem?.name ?? "—"}</Text>

            <Text style={[styles.modalLabel, styles.modalLabelTop]}>Quantity</Text>
            <TextInput
              value={editQtyText}
              onChangeText={(v) => setEditQtyText(v.replace(/[^0-9]/g, ""))}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              style={[formStyles.inputAlt, styles.modalInput]}
              editable={!savingEdit}
            />

            <Text style={styles.modalLabel}>Store</Text>

            {storesLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.storeListWrap}>
                <TouchableOpacity
                  style={[
                    styles.storeChoice,
                    editStoreId === null && styles.storeChoiceSelected,
                  ]}
                  onPress={() => setEditStoreId(null)}
                  disabled={savingEdit}
                >
                  <Text style={styles.storeChoiceText}>No store</Text>
                </TouchableOpacity>

                <FlatList
                  data={stores}
                  keyExtractor={(s) => String(s.id)}
                  style={styles.storeList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.storeChoice,
                        editStoreId === item.id && styles.storeChoiceSelected,
                      ]}
                      onPress={() => setEditStoreId(item.id)}
                      disabled={savingEdit}
                    >
                      <Text style={styles.storeChoiceText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <Text style={styles.modalLabel}>Expiry</Text>

            <View style={styles.expiryRow}>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.secondary, styles.flexButton]}
                onPress={() => setExpiryMenuOpen(true)}
                disabled={savingEdit}
              >
                <Text style={buttonStyles.secondaryText}>
                  {editExpiryDate.trim()
                    ? `Picked: ${formatDisplayDate(editExpiryDate)}`
                    : "Pick a date"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.danger]}
                onPress={() => setEditExpiryDate("")}
                disabled={savingEdit}
              >
                <Text style={buttonStyles.dangerText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={editExpiryDate}
              onChangeText={setEditExpiryDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={[formStyles.inputAlt, styles.modalInput]}
              editable={!savingEdit}
            />

            <TouchableOpacity
              style={[
                buttonStyles.base,
                buttonStyles.accent,
                savingEdit && styles.dimmed,
              ]}
              onPress={saveEdit}
              disabled={savingEdit}
            >
              <Text style={buttonStyles.accentText}>
                {savingEdit ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                buttonStyles.base,
                buttonStyles.primary,
                styles.modalCloseBtn,
                savingEdit && styles.dimmed,
              ]}
              onPress={closeEditModal}
              disabled={savingEdit}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={expiryMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExpiryMenuOpen(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Select expiry date</Text>

            <TouchableOpacity
              style={modalStyles.topAction}
              onPress={() => {
                setEditExpiryDate(formatDateYYYYMMDD(addDays(new Date(), 0)));
                setExpiryMenuOpen(false);
              }}
            >
              <Text style={modalStyles.topActionText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={modalStyles.topAction}
              onPress={() => {
                setEditExpiryDate("");
                setExpiryMenuOpen(false);
              }}
            >
              <Text style={styles.noExpiryText}>No expiry</Text>
            </TouchableOpacity>

            <View style={styles.modalSpacer} />

            <FlatList
              data={dateOptions}
              keyExtractor={(it) => it.key}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.row}
                  onPress={() => {
                    setEditExpiryDate(item.value ?? "");
                    setExpiryMenuOpen(false);
                  }}
                >
                  <Text style={modalStyles.rowText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, styles.modalCloseBtn]}
              onPress={() => setExpiryMenuOpen(false)}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  smallBtnText: {
    color: colors.primary,
    fontWeight: fontWeight.heavy,
  },
  card: {
    marginTop: spacing.lg,
  },
  emptyText: {
    color: colors.text,
    fontWeight: fontWeight.heavy,
  },
  primaryBtn2: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  itemRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
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
  itemHint: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontWeight: fontWeight.black,
    fontSize: fontSize.xs,
  },
  modalSub: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  modalLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    color: colors.text,
    fontWeight: fontWeight.black,
  },
  modalLabelTop: {
    marginTop: spacing.md,
  },
  modalInput: {
    marginBottom: 0,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  storeListWrap: {
    marginTop: spacing.sm,
  },
  storeList: {
    maxHeight: 220,
  },
  storeChoice: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  storeChoiceSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  storeChoiceText: {
    fontWeight: fontWeight.black,
    color: colors.text,
  },
  modalSpacer: {
    height: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  noExpiryText: {
    fontWeight: fontWeight.black,
    color: colors.danger,
  },
  modalCloseBtn: {
    marginTop: spacing.lg,
  },
  dimmed: {
    opacity: 0.6,
  },
});