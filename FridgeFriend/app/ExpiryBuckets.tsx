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

  // Include "no expiry" option at the top
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

    out.push({ key: v, label: `${pretty} (${v})`, value: v });
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
    storeId?: string; // "" means null
    storeName?: string;
    foodTypeId?: string; // optional
  }>();

  const userId = params.user_id;
  const productId = params.productId;
  const storeId = params.storeId ? params.storeId : ""; // "" => null

  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  const storeLabel = useMemo(
    () => params.storeName ?? "No store",
    [params.storeName]
  );

  const [overrideText, setOverrideText] = useState<string>("");

  // Change-expiry modal state
  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);
  const [editingFromExpiry, setEditingFromExpiry] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // Set-quantity modal state
  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyEditingExpiry, setQtyEditingExpiry] = useState<string | null>(null);
  const [qtyCurrent, setQtyCurrent] = useState<number>(0);
  const [qtyInput, setQtyInput] = useState<string>("");
  const [qtySaving, setQtySaving] = useState(false);

  // Edit store/price modal state
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

    // If nothing changed, just close
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

      // Refresh the new group, and update route params so the grouping view matches new store
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
    <View style={styles.container}>
      <Text style={styles.title}>{headerText}</Text>
      <Text style={styles.subtitle}>Store: {storeLabel}</Text>

      <View style={styles.headerButtonsRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={openEditMeta}>
          <Text style={styles.editBtnText}>Edit store/price</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <ScrollView
          style={{ width: "100%", marginTop: 12 }}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.overrideCard}>
            <Text style={styles.overrideTitle}>Expiry notification override</Text>
            <Text style={styles.overrideHint}>
              Set days-before-expiry for this product + store. Use 0 (or blank) to follow Settings.
            </Text>

            <TextInput
              value={overrideText}
              onChangeText={setOverrideText}
              placeholder="e.g. 3"
              keyboardType="number-pad"
              style={styles.overrideInput}
            />

            <TouchableOpacity style={styles.saveOverrideBtn} onPress={saveOverride}>
              <Text style={styles.saveOverrideText}>Save override</Text>
            </TouchableOpacity>
          </View>

          {buckets.map((b, i) => {
            const expNorm = normalizeExpiryForApi(b.expiry_date);
            return (
              <View key={`${String(b.expiry_date)}-${i}`} style={styles.bucketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bucketTitle}>
                    {expNorm ? `Expires: ${expNorm}` : "No expiry date"}
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
                      style={styles.changeBtn}
                      onPress={() => openChangeExpiry(expNorm)}
                    >
                      <Text style={styles.changeBtnText}>Change date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeAllBtn}
                      onPress={() => removeAllFromBucket(expNorm, b.quantity)}
                    >
                      <Text style={styles.removeAllBtnText}>Remove all</Text>
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

      {/* Change expiry modal */}
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change expiry for this bucket</Text>
            <Text style={styles.modalSub}>
              Current: {normalizeExpiryForApi(editingFromExpiry) ? normalizeExpiryForApi(editingFromExpiry) : "No expiry date"}
            </Text>

            <Text style={styles.quickTitle}>Quick set</Text>
            <View style={styles.quickRow}>
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <TouchableOpacity
                  key={String(d)}
                  style={styles.quickBtn}
                  onPress={() => changeBucketExpiryTo(formatDateYYYYMMDD(addDays(new Date(), d)))}
                  disabled={changing}
                >
                  <Text style={styles.quickBtnText}>{d}d</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#eee" }]}
                onPress={() => changeBucketExpiryTo(null)}
                disabled={changing}
              >
                <Text style={[styles.quickBtnText, { color: "#b00020" }]}>No expiry</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 12 }} />

            <FlatList
              data={dateOptions}
              keyExtractor={(it) => it.key}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => changeBucketExpiryTo(item.value)}
                  disabled={changing}
                >
                  <Text style={styles.modalRowText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[styles.modalClose, changing && { opacity: 0.6 }]}
              onPress={() => {
                if (changing) return;
                setExpiryMenuOpen(false);
                setEditingFromExpiry(null);
              }}
              disabled={changing}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>

            {changing && (
              <View style={{ marginTop: 10 }}>
                <ActivityIndicator />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Set quantity modal */}
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set quantity</Text>
            <Text style={styles.modalSub}>
              Bucket: {normalizeExpiryForApi(qtyEditingExpiry) ? normalizeExpiryForApi(qtyEditingExpiry) : "No expiry date"}
            </Text>

            <Text style={styles.modalSub}>Current: {qtyCurrent}</Text>

            <TextInput
              value={qtyInput}
              onChangeText={setQtyInput}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              style={styles.qtyInput}
              editable={!qtySaving}
            />

            <TouchableOpacity
              style={[styles.saveQtyBtn, qtySaving && { opacity: 0.6 }]}
              onPress={saveSetQuantity}
              disabled={qtySaving}
            >
              {qtySaving ? <ActivityIndicator /> : <Text style={styles.saveQtyBtnText}>Save</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalClose, qtySaving && { opacity: 0.6 }]}
              onPress={() => {
                if (qtySaving) return;
                setQtyModalOpen(false);
                setQtyEditingExpiry(null);
              }}
              disabled={qtySaving}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit store/price modal */}
      <Modal
        visible={editModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (savingMeta) return;
          setEditModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit store and last price</Text>

            <Text style={styles.modalSub}>Store</Text>

            {storesLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={{ marginTop: 8 }}>
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
                  style={{ maxHeight: 220 }}
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

            <Text style={[styles.modalSub, { marginTop: 12 }]}>Last price (optional)</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="e.g. 2.49"
              keyboardType="decimal-pad"
              style={styles.priceInput}
              editable={!savingMeta}
            />

            <TouchableOpacity
              style={[styles.saveQtyBtn, savingMeta && { opacity: 0.6 }]}
              onPress={saveEditMeta}
              disabled={savingMeta}
            >
              {savingMeta ? <ActivityIndicator /> : <Text style={styles.saveQtyBtnText}>Save</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalClose, savingMeta && { opacity: 0.6 }]}
              onPress={() => {
                if (savingMeta) return;
                setEditModalOpen(false);
              }}
              disabled={savingMeta}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#663399" },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "white", marginTop: 6, opacity: 0.9 },

  headerButtonsRow: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },

  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#663399", fontWeight: "800" },

  editBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ffcc00",
    padding: 10,
    borderRadius: 10,
  },
  editBtnText: { color: "#333", fontWeight: "900" },

  overrideCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overrideTitle: { fontWeight: "900", color: "#333" },
  overrideHint: { marginTop: 6, color: "#666" },
  overrideInput: {
    marginTop: 10,
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveOverrideBtn: {
    marginTop: 10,
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveOverrideText: { fontWeight: "900", color: "#333" },

  bucketRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  bucketTitle: { color: "#333", fontWeight: "800" },

  qtyTap: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bucketQty: { color: "#333", fontWeight: "900" },
  qtyHint: { marginTop: 2, color: "#663399", fontWeight: "800", fontSize: 12 },

  bucketActionsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },

  changeBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  changeBtnText: { fontWeight: "900", color: "#333" },

  removeAllBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#b00020",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  removeAllBtnText: { fontWeight: "900", color: "#fff" },

  ctrlBtn: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 10,
  },
  ctrlBtnDisabled: { opacity: 0.5 },
  ctrlBtnText: { fontSize: 18, fontWeight: "900", color: "#333" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  modalTitle: { fontWeight: "900", fontSize: 16, color: "#333" },
  modalSub: { marginTop: 6, color: "#666", fontWeight: "700" },

  quickTitle: { marginTop: 12, fontWeight: "800", color: "#333" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickBtn: {
    backgroundColor: "#ffcc00",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickBtnText: { fontWeight: "900", color: "#333" },

  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalRowText: { color: "#333", fontWeight: "700" },

  qtyInput: {
    marginTop: 12,
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  priceInput: {
    marginTop: 10,
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  saveQtyBtn: {
    marginTop: 12,
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveQtyBtnText: { fontWeight: "900", color: "#333" },

  modalClose: {
    marginTop: 12,
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "900" },

  storeChoice: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  storeChoiceSelected: {
    borderWidth: 2,
    borderColor: "#663399",
  },
  storeChoiceText: { fontWeight: "900", color: "#333" },
});