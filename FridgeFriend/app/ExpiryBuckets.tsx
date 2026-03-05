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

  // If backend returned ISO/timestamp-like, slice date part
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return s;
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
    if (
      t &&
      (!Number.isFinite(Number(t)) ||
        !Number.isInteger(Number(t)) ||
        Number(t) < 0)
    ) {
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

  const removeFromBucket = async (expiryDate: string | null) => {
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
          quantity: 1,
        }),
      });

      if (!resp.ok) throw new Error("Remove failed");
      await fetchBuckets();
    } catch (e) {
      console.error("removeFromBucket error:", e);
      Alert.alert("Error", "Could not remove item from this expiry bucket.");
    }
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

    // If user picked the same value, do nothing
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

  const headerText = useMemo(() => {
    const p = params.productName ?? "Product";
    return p;
  }, [params.productName]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{headerText}</Text>
      <Text style={styles.subtitle}>Store: {storeLabel}</Text>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

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

          {buckets.map((b, i) => (
            <View key={`${String(b.expiry_date)}-${i}`} style={styles.bucketRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bucketTitle}>
                  {normalizeExpiryForApi(b.expiry_date)
                    ? `Expires: ${normalizeExpiryForApi(b.expiry_date)}`
                    : "No expiry date"}
                </Text>
                <Text style={styles.bucketQty}>Qty: {b.quantity}</Text>

                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => openChangeExpiry(normalizeExpiryForApi(b.expiry_date))}
                >
                  <Text style={styles.changeBtnText}>Change date</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.ctrlBtn, b.quantity <= 0 && styles.ctrlBtnDisabled]}
                onPress={() => removeFromBucket(normalizeExpiryForApi(b.expiry_date))}
                disabled={b.quantity <= 0}
              >
                <Text style={styles.ctrlBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => addToBucket(normalizeExpiryForApi(b.expiry_date))}
              >
                <Text style={styles.ctrlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ))}
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
                  onPress={() =>
                    changeBucketExpiryTo(formatDateYYYYMMDD(addDays(new Date(), d)))
                  }
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#663399" },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "white", marginTop: 6, opacity: 0.9 },

  backBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#663399", fontWeight: "800" },

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
  bucketQty: { color: "#555", marginTop: 4 },

  changeBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  changeBtnText: { fontWeight: "900", color: "#333" },

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

  modalClose: {
    marginTop: 12,
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "900" },
});