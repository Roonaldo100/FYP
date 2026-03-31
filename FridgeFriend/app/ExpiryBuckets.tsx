import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { modalStyles } from "../styles/modals";
import { colors, fontSize, fontWeight, radius, spacing } from "../styles/tokens";

import { formatDisplayDate, normalizeExpiryDisplay } from "../lib/dateUtils";

type Bucket = {
  expiry_date: string | null;
  quantity: number;
};

type Store = { id: number; name: string };

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
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    out.push({ key: v, label: pretty, value: v });
  }
  return out;
}

function normalizeExpiryForApi(v: string | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function parseNonNegativeInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function parseNonNegativeMoney(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function ExpiryBuckets() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    productId?: string;
    productName?: string;
    storeId?: string;
    storeName?: string;
    foodTypeId?: string;
  }>();

  const userId = params.user_id;
  const productId = params.productId;
  const storeId = params.storeId ? params.storeId : "";

  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  const storeLabel = useMemo(
    () => params.storeName ?? "No store",
    [params.storeName]
  );

  const [overrideText, setOverrideText] = useState<string>("");

  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);
  const [editingFromExpiry, setEditingFromExpiry] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyEditingExpiry, setQtyEditingExpiry] = useState<string | null>(null);
  const [qtyCurrent, setQtyCurrent] = useState<number>(0);
  const [qtyInput, setQtyInput] = useState<string>("");
  const [qtySaving, setQtySaving] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(
    storeId === "" ? null : Number(storeId)
  );
  const [priceText, setPriceText] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);

  const dateOptions = useMemo(() => makeNextDaysOptions(60), []);

  const fetchBuckets = useCallback(async () => {
    if (!userId || !productId) return;

    setLoading(true);
    try {
      const qs =
        `userId=${encodeURIComponent(userId)}` +
        `&productId=${encodeURIComponent(productId)}` +
        `&storeId=${encodeURIComponent(storeId)}`;

      const r = await fetch(`${API_BASE_URL}/user_products/buckets?${qs}`);
      const data = await r.json();
      setBuckets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchBuckets error:", e);
      Alert.alert("Error", "Could not load expiry buckets.");
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [userId, productId, storeId]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const saveOverride = useCallback(async () => {
    if (!userId || !productId) return;

    const t = overrideText.trim();
    if (t && parseNonNegativeInt(t) === null) {
      Alert.alert("Invalid value", "Enter a whole number ≥ 0 (or leave blank).");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/user_products/setExpiryPeriod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate: null,
          expiryPeriodDays: t ? Number(t) : 0,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("setExpiryPeriod failed:", resp.status, txt);
        throw new Error("Update failed");
      }

      Alert.alert("Saved", "Expiry notification override updated.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update expiry notification override.");
    }
  }, [userId, productId, storeId, overrideText]);

  const addToBucket = async (expiryDate: string | null) => {
    if (!userId || !productId) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate,
          price: null,
        }),
      });

      if (!resp.ok) throw new Error("Add failed");
      await fetchBuckets();
    } catch (e) {
      console.error("addToBucket error:", e);
      Alert.alert("Error", "Could not add item to this expiry bucket.");
    }
  };

  const removeFromBucket = async (expiryDate: string | null, qty: number = 1) => {
    if (!userId || !productId) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/user_products/removeByExpiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          expiryDate,
          quantity: qty,
        }),
      });

      if (!resp.ok) throw new Error("Remove failed");
      await fetchBuckets();
    } catch (e) {
      console.error("removeFromBucket error:", e);
      Alert.alert("Error", "Could not remove item(s) from this expiry bucket.");
    }
  };

  const removeAllFromBucket = async (expiryDate: string | null, currentQty: number) => {
    if (currentQty <= 0) return;

    Alert.alert(
      "Remove all?",
      `Remove all ${currentQty} item(s) from this bucket?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove all",
          style: "destructive",
          onPress: async () => {
            await removeFromBucket(expiryDate, currentQty);
          },
        },
      ]
    );
  };

  const openChangeExpiry = (fromExpiry: string | null) => {
    setEditingFromExpiry(fromExpiry);
    setExpiryMenuOpen(true);
  };

  const changeBucketExpiryTo = async (toExpiry: string | null) => {
    if (!userId || !productId) return;
    if (!expiryMenuOpen) return;

    const fromExpiryNorm = normalizeExpiryForApi(editingFromExpiry);
    const toExpiryNorm = normalizeExpiryForApi(toExpiry);

    if ((fromExpiryNorm ?? null) === (toExpiryNorm ?? null)) {
      setExpiryMenuOpen(false);
      setEditingFromExpiry(null);
      return;
    }

    try {
      setChanging(true);

      const resp = await fetch(`${API_BASE_URL}/user_products/changeBucketExpiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: storeId === "" ? null : Number(storeId),
          fromExpiryDate: fromExpiryNorm,
          toExpiryDate: toExpiryNorm,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("changeBucketExpiry failed:", resp.status, txt);
        Alert.alert("Error", "Could not change expiry for this bucket.");
        return;
      }

      setExpiryMenuOpen(false);
      setEditingFromExpiry(null);
      await fetchBuckets();
    } catch (e) {
      console.error("changeBucketExpiry error:", e);
      Alert.alert("Error", "Could not change expiry for this bucket.");
    } finally {
      setChanging(false);
    }
  };

  const openSetQuantity = (expiryDate: string | null, currentQty: number) => {
    setQtyEditingExpiry(expiryDate);
    setQtyCurrent(currentQty);
    setQtyInput(String(currentQty));
    setQtyModalOpen(true);
  };

  const saveSetQuantity = async () => {
    if (!userId || !productId) return;

    const desired = parseNonNegativeInt(qtyInput);
    if (desired === null) {
      Alert.alert("Invalid quantity", "Enter a whole number ≥ 0.");
      return;
    }

    const expiry = normalizeExpiryForApi(qtyEditingExpiry);
    const current = qtyCurrent;

    if (desired === current) {
      setQtyModalOpen(false);
      setQtyEditingExpiry(null);
      return;
    }

    try {
      setQtySaving(true);

      if (desired < current) {
        const diff = current - desired;
        await removeFromBucket(expiry, diff);
      } else {
        const diff = desired - current;
        for (let i = 0; i < diff; i++) {
          const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              productId: Number(productId),
              storeId: storeId === "" ? null : Number(storeId),
              expiryDate: expiry,
              price: null,
            }),
          });

          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            console.error("addProduct (set qty) failed:", resp.status, txt);
            throw new Error("Add failed");
          }
        }
        await fetchBuckets();
      }

      setQtyModalOpen(false);
      setQtyEditingExpiry(null);
    } catch (e) {
      console.error("saveSetQuantity error:", e);
      Alert.alert("Error", "Could not update quantity for this bucket.");
    } finally {
      setQtySaving(false);
    }
  };

  const loadStores = useCallback(async () => {
    if (!userId) return;

    try {
      setStoresLoading(true);
      const res = await fetch(`${API_BASE_URL}/stores?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Stores fetch error:", e);
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [userId]);

  const loadCurrentPrice = useCallback(async (sid: number | null) => {
    if (!userId || !productId) return;

    try {
      const url =
        `${API_BASE_URL}/user/${encodeURIComponent(userId)}/product/${encodeURIComponent(
          productId
        )}/lastPrice?storeId=${sid ?? ""}`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.last_price !== null && data.last_price !== undefined) {
        setPriceText(String(data.last_price));
      } else {
        setPriceText("");
      }
    } catch (e) {
      console.error("Fetch last price error:", e);
    }
  }, [userId, productId]);

  const openEditMeta = async () => {
    const currentSid = storeId === "" ? null : Number(storeId);
    setSelectedStoreId(currentSid);

    await loadStores();
    await loadCurrentPrice(currentSid);

    setEditModalOpen(true);
  };

  const saveEditMeta = async () => {
    if (!userId || !productId) return;

    const fromSid = storeId === "" ? null : Number(storeId);
    const toSid = selectedStoreId;

    const priceMaybe = priceText.trim() ? parseNonNegativeMoney(priceText) : null;
    if (priceText.trim() && priceMaybe === null) {
      Alert.alert("Invalid price", "Enter a valid number ≥ 0 (or leave blank).");
      return;
    }

    if ((fromSid ?? null) === (toSid ?? null) && priceText.trim() === "") {
      setEditModalOpen(false);
      return;
    }

    try {
      setSavingMeta(true);

      const resp = await fetch(`${API_BASE_URL}/user_products/updateStoreAndPrice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          fromStoreId: fromSid,
          toStoreId: toSid,
          lastPrice: priceText.trim() ? priceMaybe : null,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("updateStoreAndPrice failed:", resp.status, txt);
        Alert.alert("Error", "Could not update store/price.");
        return;
      }

      const data = await resp.json();

      setEditModalOpen(false);

      const newStoreIdStr = data.store_id === null ? "" : String(data.store_id);
      const newStoreName = data.store_id === null ? "No store" : (data.store_name ?? "Store");

      router.replace({
        pathname: "/ExpiryBuckets",
        params: {
          user_id: String(userId),
          productId: String(productId),
          productName: params.productName ?? "Product",
          storeId: newStoreIdStr,
          storeName: newStoreName,
        },
      });
    } catch (e) {
      console.error("saveEditMeta error:", e);
      Alert.alert("Error", "Could not update store/price.");
    } finally {
      setSavingMeta(false);
    }
  };

  const headerText = useMemo(() => {
    const p = params.productName ?? "Product";
    return p;
  }, [params.productName]);

  return (
    <View style={commonStyles.screenPrimary}>
      <Text style={styles.title}>{headerText}</Text>
      <Text style={styles.subtitle}>Store: {storeLabel}</Text>

      <View style={styles.headerButtonsRow}>
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.accent]}
          onPress={openEditMeta}
        >
          <Text style={buttonStyles.accentText}>Edit store/price</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[commonStyles.card, styles.overrideCard]}>
            <Text style={styles.overrideTitle}>Expiry notification override</Text>
            <Text style={styles.overrideHint}>
              Set days-before-expiry for this product + store. Use 0 (or blank) to follow Settings.
            </Text>

            <TextInput
              value={overrideText}
              onChangeText={setOverrideText}
              placeholder="e.g. 3"
              keyboardType="number-pad"
              style={[formStyles.inputAlt, styles.overrideInput]}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.accent]}
              onPress={saveOverride}
            >
              <Text style={buttonStyles.accentText}>Save override</Text>
            </TouchableOpacity>
          </View>

          {buckets.map((b, i) => {
            const expNorm = normalizeExpiryForApi(b.expiry_date);
            return (
              <View key={`${String(b.expiry_date)}-${i}`} style={[commonStyles.card, styles.bucketRow]}>
                <View style={styles.bucketMain}>
                  <Text style={styles.bucketTitle}>
                    {expNorm ? `Expires: ${formatDisplayDate(expNorm)}` : "No expiry date"}
                  </Text>

                  <TouchableOpacity
                    onPress={() => openSetQuantity(expNorm, b.quantity)}
                    style={styles.qtyTap}
                  >
                    <Text style={styles.bucketQty}>Qty: {b.quantity}</Text>
                    <Text style={styles.qtyHint}>Tap to set</Text>
                  </TouchableOpacity>

                  <View style={styles.bucketActionsRow}>
                    <TouchableOpacity
                      style={[buttonStyles.base, buttonStyles.secondary]}
                      onPress={() => openChangeExpiry(expNorm)}
                    >
                      <Text style={buttonStyles.secondaryText}>Change date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[buttonStyles.base, buttonStyles.danger]}
                      onPress={() => removeAllFromBucket(expNorm, b.quantity)}
                    >
                      <Text style={buttonStyles.dangerText}>Remove all</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.ctrlBtn, b.quantity <= 0 && styles.ctrlBtnDisabled]}
                  onPress={() => removeFromBucket(expNorm, 1)}
                  disabled={b.quantity <= 0}
                >
                  <Text style={styles.ctrlBtnText}>−</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ctrlBtn} onPress={() => addToBucket(expNorm)}>
                  <Text style={styles.ctrlBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={expiryMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (changing) return;
          setExpiryMenuOpen(false);
          setEditingFromExpiry(null);
        }}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Change expiry for this bucket</Text>
            <Text style={styles.modalSub}>
              Current: {normalizeExpiryDisplay(editingFromExpiry) ? formatDisplayDate(editingFromExpiry) : "No expiry date"}
            </Text>

            <Text style={styles.quickTitle}>Quick set</Text>
            <View style={styles.quickRow}>
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <TouchableOpacity
                  key={String(d)}
                  style={[buttonStyles.accent, buttonStyles.pill, styles.quickBtn]}
                  onPress={() => changeBucketExpiryTo(formatDateYYYYMMDD(addDays(new Date(), d)))}
                  disabled={changing}
                >
                  <Text style={buttonStyles.accentText}>{d}d</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[buttonStyles.secondary, buttonStyles.pill, styles.quickBtn]}
                onPress={() => changeBucketExpiryTo(null)}
                disabled={changing}
              >
                <Text style={styles.noExpiryText}>No expiry</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSpacer} />

            <FlatList
              data={dateOptions}
              keyExtractor={(it) => it.key}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.row}
                  onPress={() => changeBucketExpiryTo(item.value)}
                  disabled={changing}
                >
                  <Text style={modalStyles.rowText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, changing && styles.dimmed]}
              onPress={() => {
                if (changing) return;
                setExpiryMenuOpen(false);
                setEditingFromExpiry(null);
              }}
              disabled={changing}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>

            {changing && (
              <View style={styles.modalLoader}>
                <ActivityIndicator />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={qtyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (qtySaving) return;
          setQtyModalOpen(false);
          setQtyEditingExpiry(null);
        }}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Set quantity</Text>
            <Text style={styles.modalSub}>
              Bucket: {normalizeExpiryDisplay(qtyEditingExpiry) ? formatDisplayDate(qtyEditingExpiry) : "No expiry date"}
            </Text>

            <Text style={styles.modalSub}>Current: {qtyCurrent}</Text>

            <TextInput
              value={qtyInput}
              onChangeText={setQtyInput}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              style={[formStyles.inputAlt, styles.modalInput]}
              editable={!qtySaving}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.accent, qtySaving && styles.dimmed]}
              onPress={saveSetQuantity}
              disabled={qtySaving}
            >
              {qtySaving ? <ActivityIndicator /> : <Text style={buttonStyles.accentText}>Save</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, qtySaving && styles.dimmed, styles.modalCloseBtn]}
              onPress={() => {
                if (qtySaving) return;
                setQtyModalOpen(false);
                setQtyEditingExpiry(null);
              }}
              disabled={qtySaving}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (savingMeta) return;
          setEditModalOpen(false);
        }}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Edit store and last price</Text>

            <Text style={styles.modalSub}>Store</Text>

            {storesLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.storeListWrap}>
                <TouchableOpacity
                  style={[
                    styles.storeChoice,
                    selectedStoreId === null && styles.storeChoiceSelected,
                  ]}
                  onPress={() => setSelectedStoreId(null)}
                  disabled={savingMeta}
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
                        selectedStoreId === item.id && styles.storeChoiceSelected,
                      ]}
                      onPress={() => setSelectedStoreId(item.id)}
                      disabled={savingMeta}
                    >
                      <Text style={styles.storeChoiceText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <Text style={[styles.modalSub, styles.modalSubSpacing]}>Last price (optional)</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="e.g. 2.49"
              keyboardType="decimal-pad"
              style={[formStyles.inputAlt, styles.modalInput]}
              editable={!savingMeta}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.accent, savingMeta && styles.dimmed]}
              onPress={saveEditMeta}
              disabled={savingMeta}
            >
              {savingMeta ? <ActivityIndicator /> : <Text style={buttonStyles.accentText}>Save</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, savingMeta && styles.dimmed, styles.modalCloseBtn]}
              onPress={() => {
                if (savingMeta) return;
                setEditModalOpen(false);
              }}
              disabled={savingMeta}
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
  title: {
    color: colors.primaryTextOn,
    fontSize: 22,
    fontWeight: fontWeight.heavy,
  },
  subtitle: {
    color: colors.primaryTextOn,
    marginTop: spacing.sm,
    opacity: 0.9,
  },
  headerButtonsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: "center",
  },
  backBtnText: {
    color: colors.primary,
    fontWeight: fontWeight.heavy,
  },
  scroll: {
    width: "100%",
    marginTop: spacing.md,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  overrideCard: {
    marginBottom: spacing.md,
  },
  overrideTitle: {
    fontWeight: fontWeight.black,
    color: colors.text,
  },
  overrideHint: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  overrideInput: {
    marginTop: spacing.md,
    marginBottom: 0,
  },
  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  bucketMain: {
    flex: 1,
  },
  bucketTitle: {
    color: colors.text,
    fontWeight: fontWeight.heavy,
  },
  qtyTap: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  bucketQty: {
    color: colors.text,
    fontWeight: fontWeight.black,
  },
  qtyHint: {
    marginTop: 2,
    color: colors.primary,
    fontWeight: fontWeight.heavy,
    fontSize: fontSize.xs,
  },
  bucketActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
  ctrlBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginLeft: spacing.md,
  },
  ctrlBtnDisabled: {
    opacity: 0.5,
  },
  ctrlBtnText: {
    fontSize: 18,
    fontWeight: fontWeight.black,
    color: colors.text,
  },
  modalSub: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  quickTitle: {
    marginTop: spacing.lg,
    fontWeight: fontWeight.heavy,
    color: colors.text,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  noExpiryText: {
    fontWeight: fontWeight.black,
    color: colors.danger,
  },
  modalSpacer: {
    height: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  modalLoader: {
    marginTop: spacing.md,
  },
  modalInput: {
    marginTop: spacing.lg,
    marginBottom: 0,
  },
  modalCloseBtn: {
    marginTop: spacing.lg,
  },
  dimmed: {
    opacity: 0.6,
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
  modalSubSpacing: {
    marginTop: spacing.lg,
  },
});