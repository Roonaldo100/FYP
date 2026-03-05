import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import {
  registerForLocalNotificationsAsync,
  sendExpiryNotification,
} from "../lib/notifications";

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

export default function AddItemToFridge() {
  const router = useRouter();
  const { user_id, product_id, product_name } = useLocalSearchParams<{
    user_id?: string;
    product_id?: string;
    product_name?: string;
  }>();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [newStoreName, setNewStoreName] = useState("");
  const [expiryDate, setExpiryDate] = useState(""); // YYYY-MM-DD or blank
  const [price, setPrice] = useState<string>("");

  const [loading, setLoading] = useState(false);

  const [expiryPeriodText, setExpiryPeriodText] = useState<string>("");

  // Date menu state (no native modules)
  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);
  const dateOptions = useMemo(() => makeNextDaysOptions(60), []);

  const title = useMemo(() => {
    return `Add Item: ${product_name ?? "Unnamed Product"}`;
  }, [product_name]);

  const validateExpiryPeriod = (s: string) => {
    if (!s.trim()) return true;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
  };

  const loadStores = async () => {
    try {
      const qs = user_id ? `?userId=${encodeURIComponent(String(user_id))}` : "";
      const res = await fetch(`${API_BASE_URL}/stores${qs}`);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Stores fetch error:", e);
      setStores([]);
    }
  };

  useEffect(() => {
    loadStores();
  }, [user_id]);

  useEffect(() => {
    if (!user_id || !product_id) return;

    const fetchLastPrice = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/user/${user_id}/product/${product_id}/lastPrice?storeId=${selectedStoreId ?? ""}`
        );

        if (!res.ok) return;

        const data = await res.json();

        if (data.last_price !== null && data.last_price !== undefined) {
          setPrice(String(data.last_price));
        } else {
          setPrice("");
        }
      } catch (e) {
        console.error("Fetch last price error:", e);
      }
    };

    fetchLastPrice();
  }, [selectedStoreId, user_id, product_id]);

  const createStore = async () => {
    const trimmed = newStoreName.trim();
    if (!trimmed) {
      Alert.alert("Missing store name", "Enter a store name to create it.");
      return;
    }

    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    try {
      setLoading(true);

      const resp = await fetch(`${API_BASE_URL}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, userId: Number(user_id) }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("Create store failed:", resp.status, txt);
        Alert.alert("Error", "Failed to create store.");
        return;
      }

      const created = await resp.json();
      await loadStores();
      setSelectedStoreId(Number(created.store_id));
      setNewStoreName("");
    } catch (e) {
      console.error("Create store error:", e);
      Alert.alert("Error", "Unable to create store.");
    } finally {
      setLoading(false);
    }
  };

  const setQuickExpiry = (daysFromNow: number) => {
    const v = formatDateYYYYMMDD(addDays(new Date(), daysFromNow));
    setExpiryDate(v);
    setExpiryMenuOpen(false);
  };

  const pickExpiry = (v: string) => {
    setExpiryDate(v);
    setExpiryMenuOpen(false);
  };

  const clearExpiry = () => {
    setExpiryDate("");
    setExpiryMenuOpen(false);
  };

  const confirmAdd = async () => {
    if (!user_id || !product_id) {
      Alert.alert("Error", "Missing required information.");
      return;
    }

    const trimmedExpiry = expiryDate.trim();
    const expiryToSend = trimmedExpiry.length === 0 ? null : trimmedExpiry;

    if (expiryToSend) {
      const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(expiryToSend);
      if (!okFormat) {
        Alert.alert("Invalid expiry date", "Use the format YYYY-MM-DD or leave it blank.");
        return;
      }
    }

    const periodTrim = expiryPeriodText.trim();
    if (!validateExpiryPeriod(periodTrim)) {
      Alert.alert("Invalid value", "Enter a whole number ≥ 0 (or leave blank).");
      return;
    }
    const expiryPeriodDaysToSend = periodTrim.length ? Number(periodTrim) : null;

    try {
      setLoading(true);

      const addResp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user_id,
          productId: Number(product_id),
          storeId: selectedStoreId,
          expiryDate: expiryToSend,
          price: price ? Number(price) : null,
          expiryPeriodDays: expiryPeriodDaysToSend,
        }),
      });

      if (!addResp.ok) {
        const txt = await addResp.text().catch(() => "");
        console.error("Add product failed:", addResp.status, txt);
        Alert.alert("Error", "Failed to add item.");
        return;
      }

      const inserted = await addResp.json();

      const userProductId = inserted.user_product_id;
      const daysLeft =
        inserted.days_left === null || inserted.days_left === undefined
          ? null
          : Number(inserted.days_left);

      const effectivePeriodDays =
        inserted.effective_period_days === null || inserted.effective_period_days === undefined
          ? null
          : Number(inserted.effective_period_days);

      if (
        daysLeft !== null &&
        effectivePeriodDays !== null &&
        daysLeft <= effectivePeriodDays
      ) {
        const ok = await registerForLocalNotificationsAsync();
        if (ok) {
          await sendExpiryNotification(product_name ?? "Item", daysLeft);

          if (userProductId) {
            await fetch(`${API_BASE_URL}/user_products/${userProductId}/markNotified`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      Alert.alert("Added!", "Item added to your fridge.");
      router.replace({
        pathname: "/(tabs)",
        params: { user_id: String(user_id) },
      });
    } catch (e) {
      console.error("Confirm add error:", e);
      Alert.alert("Error", "Unable to add item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Store (optional)</Text>

            <TouchableOpacity
              style={[
                styles.storeButton,
                selectedStoreId === null && styles.storeButtonSelected,
              ]}
              onPress={() => setSelectedStoreId(null)}
            >
              <Text>No store</Text>
            </TouchableOpacity>

            <View style={{ maxHeight: 180 }}>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                {stores.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.storeButton,
                      selectedStoreId === s.id && styles.storeButtonSelected,
                    ]}
                    onPress={() => setSelectedStoreId(s.id)}
                  >
                    <Text>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Create store</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aldi"
              value={newStoreName}
              onChangeText={setNewStoreName}
            />
            <TouchableOpacity style={styles.createBtn} onPress={createStore}>
              <Text style={styles.createBtnText}>Create store</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1.50"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry (optional)</Text>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setExpiryMenuOpen(true)}
              >
                <Text style={styles.secondaryBtnText}>
                  {expiryDate.trim() ? `Picked: ${expiryDate}` : "Pick a date"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearBtn} onPress={clearExpiry}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickTitle}>Quick set</Text>
            <View style={styles.quickRow}>
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <TouchableOpacity
                  key={String(d)}
                  style={styles.quickBtn}
                  onPress={() => setQuickExpiry(d)}
                >
                  <Text style={styles.quickBtnText}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.helperText}>
              You can still type manually if you want:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={expiryDate}
              onChangeText={setExpiryDate}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry notification override (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Days before expiry to notify (blank = use Settings)"
              keyboardType="number-pad"
              value={expiryPeriodText}
              onChangeText={setExpiryPeriodText}
            />
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={confirmAdd}>
            <Text style={styles.confirmButtonText}>Confirm and Add</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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
  container: { flex: 1, backgroundColor: "#663399", padding: 20 },
  title: { color: "white", fontSize: 18, marginBottom: 12 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: "700", marginBottom: 8 },
  input: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
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

  confirmButton: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  confirmButtonText: { color: "#663399", fontWeight: "bold" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
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