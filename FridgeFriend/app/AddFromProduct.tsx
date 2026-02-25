import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

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

  // Store is optional. We'll accept either:
  // - blank => null (No store)
  // - numeric storeId
  const [storeIdText, setStoreIdText] = useState<string>("");

  // Expiry is optional: YYYY-MM-DD or blank
  const [expiryText, setExpiryText] = useState<string>("");

  // Price optional: numeric or blank
  const [priceText, setPriceText] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const validateExpiry = (s: string) => {
    if (!s.trim()) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  };

  const validatePrice = (s: string) => {
    if (!s.trim()) return true;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0;
  };

  const onSave = useCallback(async () => {
    if (!userId || !productId) {
      Alert.alert("Error", "Missing user or product.");
      return;
    }

    const storeTrim = storeIdText.trim();
    const expiryTrim = expiryText.trim();
    const priceTrim = priceText.trim();

    // Store ID: optional, but if provided must be a valid number
    let storeId: number | null = null;
    if (storeTrim.length > 0) {
      const n = Number(storeTrim);
      if (!Number.isFinite(n) || n <= 0) {
        Alert.alert("Invalid store", "Store ID must be a positive number (or blank for no store).");
        return;
      }
      storeId = n;
    }

    // Expiry: optional, but if provided must be YYYY-MM-DD
    if (!validateExpiry(expiryTrim)) {
      Alert.alert("Invalid expiry", "Use YYYY-MM-DD (e.g. 2026-02-27) or leave blank.");
      return;
    }

    // Price: optional, but if provided must be >= 0
    if (!validatePrice(priceTrim)) {
      Alert.alert("Invalid price", "Enter a valid number (e.g. 2.99) or leave blank.");
      return;
    }

    const expiryDate: string | null = expiryTrim.length > 0 ? expiryTrim : null;
    const price: number | null = priceTrim.length > 0 ? Number(priceTrim) : null;

    try {
      setSaving(true);

      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: Number(productId),
          storeId,       // null allowed
          expiryDate,    // null allowed
          price,         // null allowed
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("AddFromProduct failed:", resp.status, txt);
        Alert.alert("Error", "Failed to add item.");
        return;
      }

      // Success: go back to picker (or wherever user came from)
      Alert.alert("Added", `${productName} added to your inventory.`);
      router.back();
    } catch (e) {
      console.error("AddFromProduct error:", e);
      Alert.alert("Error", "Failed to add item.");
    } finally {
      setSaving(false);
    }
  }, [userId, productId, storeIdText, expiryText, priceText, productName, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add item</Text>
      <Text style={styles.subtitle}>{productName}</Text>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={saving}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.label}>Store ID (optional)</Text>
        <TextInput
          value={storeIdText}
          onChangeText={setStoreIdText}
          placeholder="e.g. 3 (blank = No store)"
          style={styles.input}
          keyboardType="number-pad"
          editable={!saving}
        />

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

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.saveBtnText}>Add to inventory</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.help}>
          Tip: Expiry is used for expiry buckets. Leave blank if this item doesn’t expire.
        </Text>
      </View>
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
  },

  saveBtn: {
    marginTop: 16,
    backgroundColor: "#ffcc00",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#333", fontWeight: "900", fontSize: 16 },

  help: { marginTop: 10, color: "#666" },
});