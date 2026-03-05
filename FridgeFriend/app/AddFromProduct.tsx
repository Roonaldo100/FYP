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
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

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
  const out: { key: string; label: string; value: string }[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

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

export default function AddFromProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    productId?: string;
    productName?: string;
  }>();

  const userId = params.user_id;
  const productId = params.productId;

  const productName = useMemo(() => params.productName ?? "Product", [params.productName]);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [newStoreName, setNewStoreName] = useState("");

  const [expiryText, setExpiryText] = useState<string>("");
  const [priceText, setPriceText] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);

  const [expiryPeriodText, setExpiryPeriodText] = useState<string>("");

  // Date menu state (no native modules)
  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);
  const dateOptions = useMemo(() => makeNextDaysOptions(60), []);

  const validateExpiryPeriod = (s: string) => {
    if (!s.trim()) return true;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
  };

  const validateExpiry = (s: string) => {
    if (!s.trim()) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  };

  const validatePrice = (s: string) => {
    if (!s.trim()) return true;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0;
  };

  const loadStores = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadingStores(true);
      const res = await fetch(
        `${API_BASE_URL}/stores?userId=${encodeURIComponent(String(userId))}`
      );
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Stores fetch error:", e);
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  }, [userId]);

  const loadLastAny = useCallback(async () => {
    if (!userId || !productId) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${encodeURIComponent(String(userId))}/product/${encodeURIComponent(
          String(productId)
        )}/lastPriceAny`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data?.store_id !== undefined && data?.store_id !== null) {
        setSelectedStoreId(Number(data.store_id));
      } else {
        setSelectedStoreId(null);
      }

      if (data?.last_price !== null && data?.last_price !== undefined) {
        setPriceText(String(data.last_price));
      } else {
        setPriceText("");
      }
    } catch (e) {
      console.error("Load lastPriceAny error:", e);
    }
  }, [userId, productId]);

  useEffect(() => {
    if (!userId || !productId) return;

    const fetchLastPriceForStore = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/user/${userId}/product/${productId}/lastPrice?storeId=${selectedStoreId ?? ""}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.last_price !== null && data.last_price !== undefined) {
          setPriceText(String(data.last_price));
        }
      } catch (e) {
        console.error("Fetch last price error:", e);
      }
    };

    fetchLastPriceForStore();
  }, [selectedStoreId, userId, productId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    loadLastAny();
  }, [loadLastAny]);

  const createStore = useCallback(async () => {
    const trimmed = newStoreName.trim();
    if (!trimmed) {
      Alert.alert("Missing store name", "Enter a store name.");
      return null;
    }
    if (!userId) {
      Alert.alert("Error", "Missing user.");
      return null;
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, userId: Number(userId) }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("Create store failed:", resp.status, txt);
        Alert.alert("Error", "Failed to create store.");
        return null;
      }

      const created = await resp.json();
      await loadStores();
      setNewStoreName("");
      return Number(created.store_id);
    } catch (e) {
      console.error("Create store error:", e);
      Alert.alert("Error", "Failed to create store.");
      return null;
    }
  }, [newStoreName, userId, loadStores]);

  const setQuickExpiry = (daysFromNow: number) => {
    setExpiryText(formatDateYYYYMMDD(addDays(new Date(), daysFromNow)));
    setExpiryMenuOpen(false);
  };

  const pickExpiry = (v: string) => {
    setExpiryText(v);
    setExpiryMenuOpen(false);
  };

  const clearExpiry = () => {
    setExpiryText("");
    setExpiryMenuOpen(false);
  };

  const onSave = useCallback(async () => {
    if (!userId || !productId) {
      Alert.alert("Error", "Missing user or product.");
      return;
    }

    const expiryTrim = expiryText.trim();
    const priceTrim = priceText.trim();

    if (!validateExpiry(expiryTrim)) {
      Alert.alert("Invalid expiry", "Use YYYY-MM-DD (e.g. 2026-02-27) or leave blank.");
      return;
    }

    if (!validatePrice(priceTrim)) {
      Alert.alert("Invalid price", "Enter a valid number (e.g. 2.99) or leave blank.");
      return;
    }

    const expiryDate: string | null = expiryTrim.length > 0 ? expiryTrim : null;
    const price: number | null = priceTrim.length > 0 ? Number(priceTrim) : null;

    const periodTrim = expiryPeriodText.trim();
    if (!validateExpiryPeriod(periodTrim)) {
      Alert.alert("Invalid value", "Enter a whole number ≥ 0 (or leave blank).");
      return;
    }
    const expiryPeriodDays: number | null = periodTrim.length > 0 ? Number(periodTrim) : null;

    try {
      setSaving(true);

      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId: selectedStoreId,
          expiryDate,
          price,
          expiryPeriodDays,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("AddFromProduct failed:", resp.status, txt);
        Alert.alert("Error", "Failed to add item.");
        return;
      }

      Alert.alert("Added", `${productName} added to your inventory.`);
      router.back();
    } catch (e) {
      console.error("AddFromProduct error:", e);
      Alert.alert("Error", "Failed to add item.");
    } finally {
      setSaving(false);
    }
  }, [
    userId,
    productId,
    expiryText,
    priceText,
    productName,
    router,
    selectedStoreId,
    expiryPeriodText,
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add item</Text>
      <Text style={styles.subtitle}>{productName}</Text>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={saving}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.card}>
          <Text style={styles.label}>Store (optional)</Text>

          {loadingStores ? (
            <ActivityIndicator />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.storeButton, selectedStoreId === null && styles.storeButtonSelected]}
                onPress={() => setSelectedStoreId(null)}
                disabled={saving}
              >
                <Text>No store</Text>
              </TouchableOpacity>

              <View style={{ maxHeight: 220 }}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {stores.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.storeButton, selectedStoreId === s.id && styles.storeButtonSelected]}
                      onPress={() => setSelectedStoreId(s.id)}
                      disabled={saving}
                    >
                      <Text>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={[styles.label, { marginTop: 10 }]}>Create store</Text>
              <TextInput
                value={newStoreName}
                onChangeText={setNewStoreName}
                placeholder="e.g. Aldi"
                style={styles.input}
                editable={!saving}
              />
              <TouchableOpacity
                style={styles.createBtn}
                onPress={async () => {
                  const sid = await createStore();
                  if (sid) setSelectedStoreId(sid);
                }}
                disabled={saving}
              >
                <Text style={styles.createBtnText}>Create and select</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Expiry date (optional)</Text>

          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setExpiryMenuOpen(true)} disabled={saving}>
              <Text style={styles.secondaryBtnText}>
                {expiryText.trim() ? `Picked: ${expiryText}` : "Pick a date"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearBtn} onPress={clearExpiry} disabled={saving}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.quickTitle}>Quick set</Text>
          <View style={styles.quickRow}>
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <TouchableOpacity key={String(d)} style={styles.quickBtn} onPress={() => setQuickExpiry(d)} disabled={saving}>
                <Text style={styles.quickBtnText}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.helperText}>You can still type manually if you want:</Text>
          <TextInput
            value={expiryText}
            onChangeText={setExpiryText}
            placeholder="YYYY-MM-DD (blank = no expiry)"
            style={styles.input}
            autoCapitalize="none"
            editable={!saving}
          />

          <Text style={styles.label}>Price (optional)</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="e.g. 2.99 (blank = unknown)"
            style={styles.input}
            keyboardType="decimal-pad"
            editable={!saving}
          />

          <Text style={styles.label}>Expiry notification override (optional)</Text>
          <TextInput
            value={expiryPeriodText}
            onChangeText={setExpiryPeriodText}
            placeholder="Days before expiry to notify (blank = use Settings)"
            style={styles.input}
            keyboardType="number-pad"
            editable={!saving}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator /> : <Text style={styles.saveBtnText}>Add to inventory</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={expiryMenuOpen} transparent animationType="fade" onRequestClose={() => setExpiryMenuOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select expiry date</Text>

            <TouchableOpacity style={styles.modalTopAction} onPress={() => pickExpiry(formatDateYYYYMMDD(addDays(new Date(), 0)))}>
              <Text style={styles.modalTopActionText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalTopAction} onPress={() => clearExpiry()}>
              <Text style={[styles.modalTopActionText, { color: "#b00020" }]}>No expiry</Text>
            </TouchableOpacity>

            <View style={{ height: 12 }} />

            <FlatList
              data={dateOptions}
              keyExtractor={(it) => it.key}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => pickExpiry(item.value)}>
                  <Text style={styles.modalRowText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.modalClose} onPress={() => setExpiryMenuOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#663399", padding: 16 },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "white", marginTop: 6, opacity: 0.9, fontSize: 16, fontWeight: "700" },

  backBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#663399", fontWeight: "800" },

  card: { marginTop: 14, backgroundColor: "#fff", borderRadius: 12, padding: 14 },

  label: { color: "#333", fontWeight: "800", marginTop: 10, marginBottom: 6 },

  input: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },

  storeButton: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  storeButtonSelected: { backgroundColor: "#ffcc00" },

  createBtn: {
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  createBtnText: { color: "#fff", fontWeight: "900" },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  secondaryBtnText: { fontWeight: "800", color: "#333" },
  clearBtn: {
    backgroundColor: "#b00020",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  clearBtnText: { color: "#fff", fontWeight: "900" },

  quickTitle: { marginTop: 10, fontWeight: "800", color: "#333" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickBtn: {
    backgroundColor: "#ffcc00",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickBtnText: { fontWeight: "900", color: "#333" },

  helperText: { marginTop: 10, marginBottom: 6, color: "#666", fontSize: 12 },

  saveBtn: {
    marginTop: 16,
    backgroundColor: "#ffcc00",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#333", fontWeight: "900", fontSize: 16 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  modalTitle: { fontWeight: "900", fontSize: 16, color: "#333", marginBottom: 10 },

  modalTopAction: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  modalTopActionText: { fontWeight: "900", color: "#333" },

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