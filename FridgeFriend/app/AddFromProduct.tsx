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

type Store = { id: number; name: string };

export default function AddFromProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    productId?: string;
    productName?: string;
  }>();

  const userId = params.user_id;
  const productId = params.productId;

  const productName = useMemo(
    () => params.productName ?? "Product",
    [params.productName]
  );

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [newStoreName, setNewStoreName] = useState("");

  const [expiryText, setExpiryText] = useState<string>("");
  const [priceText, setPriceText] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);

  const [expiryPeriodText, setExpiryPeriodText] = useState<string>("");

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
      const res = await fetch(`${API_BASE_URL}/stores?userId=${encodeURIComponent(String(userId))}`);
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

  const clearPersonalHistory = useCallback(async () => {
    if (!userId || !productId) return;

    const run = async (confirmDeleteInventory: boolean) => {
      const resp = await fetch(
        `${API_BASE_URL}/user/${encodeURIComponent(String(userId))}/product/${encodeURIComponent(
          String(productId)
        )}/clearPersonalHistory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmDeleteInventory }),
        }
      );

      const text = await resp.text().catch(() => "");
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}

      if (resp.status === 409 && data?.requiresConfirmation) {
        Alert.alert(
          "This will delete inventory",
          `You currently have ${data.inventoryCount} item(s) of "${productName}" in your fridge.\n\nClearing history will also delete those inventory items.\n\nProceed?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete history + inventory",
              style: "destructive",
              onPress: async () => {
                try {
                  setSaving(true);
                  await run(true);
                  Alert.alert("Cleared", "Your history (and inventory for this product) was removed.");
                  router.back();
                } catch (e) {
                  Alert.alert("Error", "Failed to clear history.");
                } finally {
                  setSaving(false);
                }
              },
            },
          ]
        );
        return;
      }

      if (!resp.ok) {
        console.error("clearPersonalHistory failed:", resp.status, text);
        Alert.alert("Error", data?.message || "Failed to clear history.");
        return;
      }

      Alert.alert("Cleared", "Your history for this product was removed.");
      router.back();
    };

    Alert.alert(
      "Clear history?",
      `Remove "${productName}" from your historical data?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await run(false);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [userId, productId, productName, router]);

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
  }, [userId, productId, expiryText, priceText, productName, router, selectedStoreId]);

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
                style={[
                  styles.storeButton,
                  selectedStoreId === null && styles.storeButtonSelected,
                ]}
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
                      style={[
                        styles.storeButton,
                        selectedStoreId === s.id && styles.storeButtonSelected,
                      ]}
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

          <TouchableOpacity style={styles.dangerBtn} onPress={clearPersonalHistory} disabled={saving}>
            <Text style={styles.dangerBtnText}>Clear my history for this product</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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

  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },

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
  storeButtonSelected: {
    backgroundColor: "#ffcc00",
  },

  createBtn: {
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  createBtnText: { color: "#fff", fontWeight: "900" },

  saveBtn: {
    marginTop: 16,
    backgroundColor: "#ffcc00",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#333", fontWeight: "900", fontSize: 16 },

  dangerBtn: {
    marginTop: 10,
    backgroundColor: "#b00020",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "900" },
});