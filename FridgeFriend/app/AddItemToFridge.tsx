// C:\Users\ruben\Desktop\FYP\FridgeFriend\app\AddItemToFridge.tsx
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
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import {
  registerForLocalNotificationsAsync,
  sendExpiryNotification,
} from "../lib/notifications";

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontWeight,
  radius,
  spacing,
  type AppColors,
} from "../styles/tokens";

import { formatDisplayDate, normalizeExpiryInput } from "../lib/dateUtils";

type Store = { id: number; name: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateDDMMYYYYWithDashes(value: string) {
  const normalized = normalizeExpiryInput(value);
  if (!normalized) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return normalized;

  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
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
    const iso = formatDateYYYYMMDD(d);

    const pretty = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    out.push({
      key: iso,
      label: pretty,
      value: formatDateDDMMYYYYWithDashes(iso),
    });
  }
  return out;
}

export default function AddItemToFridge() {
  const router = useRouter();
  const { colors, commonStyles, formStyles, buttonStyles, modalStyles } =
    useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    user_id,
    product_id,
    product_name,
    scanned_expiry,
    store_id,
    duplicate_name_warning,
    requested_name,
  } = useLocalSearchParams<{
    user_id?: string;
    product_id?: string;
    product_name?: string;
    scanned_expiry?: string;
    store_id?: string;
    duplicate_name_warning?: string;
    requested_name?: string;
  }>();

  const [editableProductName, setEditableProductName] = useState(
    String(product_name ?? "")
  );

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [newStoreName, setNewStoreName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [price, setPrice] = useState<string>("");
  const [quantityText, setQuantityText] = useState<string>("1");

  const [loading, setLoading] = useState(false);
  const [expiryPeriodText, setExpiryPeriodText] = useState<string>("");

  const [expiryMenuOpen, setExpiryMenuOpen] = useState(false);
  const dateOptions = useMemo(() => makeNextDaysOptions(60), []);

  useEffect(() => {
    if (duplicate_name_warning === "1" && requested_name) {
      setEditableProductName(String(requested_name));
    } else {
      setEditableProductName(String(product_name ?? ""));
    }
  }, [duplicate_name_warning, requested_name, product_name]);

  useEffect(() => {
    const sidRaw = String(store_id ?? "").trim();
    if (!sidRaw) {
      setSelectedStoreId(null);
      return;
    }

    const sid = Number(sidRaw);
    setSelectedStoreId(Number.isFinite(sid) && sid > 0 ? sid : null);
  }, [store_id]);

  useEffect(() => {
    if (!scanned_expiry) return;

    const dashed = formatDateDDMMYYYYWithDashes(String(scanned_expiry));
    if (dashed) {
      setExpiryDate(dashed);
    }
  }, [scanned_expiry]);

  const title = useMemo(() => {
    const displayName =
      editableProductName.trim() || product_name || "Unnamed Product";
    return `Add Item: ${displayName}`;
  }, [editableProductName, product_name]);

  const validateExpiryPeriod = (s: string) => {
    if (!s.trim()) return true;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
  };

  const validateQuantity = (s: string) => {
    if (!s.trim()) return false;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0;
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
          `${API_BASE_URL}/user/${user_id}/product/${product_id}/lastPrice?storeId=${
            selectedStoreId ?? ""
          }`
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
    const iso = formatDateYYYYMMDD(addDays(new Date(), daysFromNow));
    setExpiryDate(formatDateDDMMYYYYWithDashes(iso));
    setExpiryMenuOpen(false);
  };

  const pickExpiry = (v: string) => {
    setExpiryDate(formatDateDDMMYYYYWithDashes(v));
    setExpiryMenuOpen(false);
  };

  const clearExpiry = () => {
    setExpiryDate("");
    setExpiryMenuOpen(false);
  };

  const changeQuantityBy = (delta: number) => {
    const current = Number(quantityText);
    const safeCurrent =
      Number.isFinite(current) && Number.isInteger(current) && current > 0
        ? current
        : 1;
    const next = Math.max(1, safeCurrent + delta);
    setQuantityText(String(next));
  };

  const updateProductNameIfNeeded = async () => {
    if (!user_id || !product_id) return;

    const trimmed = editableProductName.trim();
    const original = String(product_name ?? "").trim();

    if (!trimmed) {
      Alert.alert("Missing product name", "Please enter a product name.");
      throw new Error("Missing product name");
    }

    if (trimmed === original) {
      if (duplicate_name_warning === "1") {
        Alert.alert(
          "Choose another name",
          "Product name in use already. Please choose another product name."
        );
        throw new Error("handled_duplicate_name");
      }
      return;
    }

    const resp = await fetch(
      `${API_BASE_URL}/user/${encodeURIComponent(
        String(user_id)
      )}/products/${encodeURIComponent(String(product_id))}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
        }),
      }
    );

    const txt = await resp.text().catch(() => "");
    let data: any = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      if (resp.status === 409) {
        Alert.alert(
          "Choose another name",
          data?.message ||
            "Product name in use already. Please choose another product name."
        );
        throw new Error("handled_duplicate_name");
      }

      console.error("Update product name failed:", resp.status, txt);
      Alert.alert(
        "Couldn't rename product",
        data?.message || "This product name couldn't be updated."
      );
      throw new Error("handled_rename_failure");
    }
  };

  const confirmAdd = async () => {
    if (!user_id || !product_id) {
      Alert.alert("Error", "Missing required information.");
      return;
    }

    const trimmedName = editableProductName.trim();
    if (!trimmedName) {
      Alert.alert("Missing product name", "Please enter a product name.");
      return;
    }

    const trimmedExpiry = expiryDate.trim();
    let expiryToSend: string | null = null;

    if (trimmedExpiry.length > 0) {
      expiryToSend = normalizeExpiryInput(trimmedExpiry);

      if (!expiryToSend) {
        Alert.alert(
          "Invalid expiry date",
          "Use dd-mm-yyyy, ddmmyyyy, YYYY-MM-DD, yyyymmdd, 25/04/26, 25/04/2026, 04 APR 2026, 11.2028, or 31.08."
        );
        return;
      }
    }

    const periodTrim = expiryPeriodText.trim();
    if (!validateExpiryPeriod(periodTrim)) {
      Alert.alert("Invalid value", "Enter a whole number ≥ 0 (or leave blank).");
      return;
    }
    const expiryPeriodDaysToSend = periodTrim.length ? Number(periodTrim) : null;

    const qtyTrim = quantityText.trim();
    if (!validateQuantity(qtyTrim)) {
      Alert.alert("Invalid quantity", "Enter a whole number greater than 0.");
      return;
    }
    const quantityToSend = Number(qtyTrim);

    const priceTrim = price.trim();

    let priceToSend: number | null;
    if (priceTrim.length === 0) {
      priceToSend = null;
    } else {
      const parsedPrice = Number(priceTrim);

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        Alert.alert("Invalid price", "Enter a valid price or leave it blank.");
        return;
      }

      priceToSend = parsedPrice;
    }

    try {
      setLoading(true);

      await updateProductNameIfNeeded();

      const addResp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user_id,
          productId: Number(product_id),
          storeId: selectedStoreId,
          expiryDate: expiryToSend,
          price: priceToSend,
          expiryPeriodDays: expiryPeriodDaysToSend,
          quantity: quantityToSend,
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
        inserted.effective_period_days === null ||
        inserted.effective_period_days === undefined
          ? null
          : Number(inserted.effective_period_days);

      if (
        daysLeft !== null &&
        effectivePeriodDays !== null &&
        daysLeft <= effectivePeriodDays
      ) {
        const ok = await registerForLocalNotificationsAsync();
        if (ok) {
          await sendExpiryNotification(trimmedName || product_name || "Item", daysLeft);

          if (userProductId) {
            await fetch(
              `${API_BASE_URL}/user_products/${userProductId}/markNotified`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      Alert.alert(
        "Added!",
        quantityToSend === 1
          ? "Item added to your fridge."
          : `${quantityToSend} items added to your fridge.`
      );

      router.replace({
        pathname: "/(tabs)",
        params: { user_id: String(user_id) },
      });
    } catch (e: any) {
      if (
        e?.message === "handled_duplicate_name" ||
        e?.message === "handled_rename_failure"
      ) {
        return;
      }

      console.error("Confirm add error:", e);
      Alert.alert("Error", "Unable to add item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={commonStyles.screenPrimary}>
      <Text style={styles.title}>{title}</Text>

      {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

      {!loading && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Product details</Text>
            <Text style={commonStyles.label}>Product name</Text>

            {duplicate_name_warning === "1" && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Product name in use already. Please choose another product name.
                </Text>
              </View>
            )}

            <TextInput
              style={[
                formStyles.inputAlt,
                duplicate_name_warning === "1" && styles.warningInput,
              ]}
              placeholder="e.g. Milk"
              placeholderTextColor={colors.textLight}
              value={editableProductName}
              onChangeText={setEditableProductName}
              autoCapitalize="words"
            />

            <Text style={commonStyles.helperText}>
              Edit the name before adding this item to your fridge
            </Text>
          </View>

          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Quantity</Text>

            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => changeQuantityBy(-1)}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                placeholder="1"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                value={quantityText}
                onChangeText={(v) => setQuantityText(v.replace(/[^0-9]/g, ""))}
              />

              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => changeQuantityBy(1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Store (optional)</Text>

            <TouchableOpacity
              style={[
                styles.storeButton,
                selectedStoreId === null && styles.storeButtonSelected,
              ]}
              onPress={() => setSelectedStoreId(null)}
            >
              <Text style={styles.storeButtonText}>No store</Text>
            </TouchableOpacity>

            <View style={styles.storeListWrap}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {stores.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.storeButton,
                      selectedStoreId === s.id && styles.storeButtonSelected,
                    ]}
                    onPress={() => setSelectedStoreId(s.id)}
                  >
                    <Text style={styles.storeButtonText}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={[commonStyles.sectionTitle, styles.subSectionTitle]}>
              Create store
            </Text>

            <TextInput
              style={formStyles.inputAlt}
              placeholder="e.g. Aldi"
              placeholderTextColor={colors.textLight}
              value={newStoreName}
              onChangeText={setNewStoreName}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={createStore}
            >
              <Text style={buttonStyles.primaryText}>Create store</Text>
            </TouchableOpacity>
          </View>

          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Price of 1 (optional)</Text>
            <TextInput
              style={formStyles.inputAlt}
              placeholder="e.g. 1.50"
              placeholderTextColor={colors.textLight}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Expiry (optional)</Text>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.accent, { marginTop: spacing.md }]}
              onPress={() => {
                router.push({
                  pathname: "/ExpiryDateScanner",
                  params: {
                    user_id: String(user_id ?? ""),
                    product_id: String(product_id ?? ""),
                    product_name: String(editableProductName || product_name || ""),
                  },
                });
              }}
            >
              <Text style={buttonStyles.accentText}>Scan expiry date</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.secondary, styles.flexButton]}
                onPress={() => setExpiryMenuOpen(true)}
              >
                <Text style={buttonStyles.secondaryText}>
                  {"Pick a date"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.danger]}
                onPress={clearExpiry}
              >
                <Text style={buttonStyles.dangerText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickTitle}>Quick set</Text>

            <View style={styles.quickRow}>
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <TouchableOpacity
                  key={String(d)}
                  style={[buttonStyles.accent, buttonStyles.pill, styles.quickBtn]}
                  onPress={() => setQuickExpiry(d)}
                >
                  <Text style={buttonStyles.accentText}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={commonStyles.helperText}>
              You can still type manually if you want:
            </Text>

            <TextInput
              style={formStyles.inputAlt}
              placeholder="Use dd-mm-yyyy"
              placeholderTextColor={colors.textLight}
              value={expiryDate}
              onChangeText={setExpiryDate}
              autoCapitalize="characters"
            />
          </View>

          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>
              Expiry notification override (optional)
            </Text>
            <TextInput
              style={formStyles.inputAlt}
              placeholder="Days before expiry to notify"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              value={expiryPeriodText}
              onChangeText={setExpiryPeriodText}
            />
          </View>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.confirmButton]}
            onPress={confirmAdd}
          >
            <Text style={styles.confirmButtonText}>
              Confirm and Add {validateQuantity(quantityText) ? Number(quantityText) : 1}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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
              onPress={() =>
                pickExpiry(formatDateDDMMYYYYWithDashes(formatDateYYYYMMDD(addDays(new Date(), 0))))
              }
            >
              <Text style={modalStyles.topActionText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalStyles.topAction} onPress={clearExpiry}>
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
                  onPress={() => pickExpiry(item.value)}
                >
                  <Text style={modalStyles.rowText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, styles.modalCloseButton]}
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

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    title: {
      color: colors.primaryTextOn,
      fontSize: 18,
      marginBottom: spacing.lg,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    qtyBtn: {
      width: 40,
      height: 40,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyBtnText: {
      fontSize: 20,
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    qtyInput: {
      minWidth: 72,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.sm,
      textAlign: "center",
      color: colors.text,
    },
    storeListWrap: {
      maxHeight: 180,
    },
    storeButton: {
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
      borderRadius: radius.sm,
      marginBottom: 6,
    },
    storeButtonSelected: {
      backgroundColor: colors.accent,
    },
    storeButtonText: {
      color: colors.text,
    },
    subSectionTitle: {
      marginTop: spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    flexButton: {
      flex: 1,
    },
    quickTitle: {
      marginTop: spacing.md,
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
    confirmButton: {
      marginTop: spacing.sm,
    },
    confirmButtonText: {
      color: colors.primary,
      fontWeight: fontWeight.bold,
    },
    noExpiryText: {
      fontWeight: fontWeight.black,
      color: colors.danger,
    },
    modalSpacer: {
      height: 12,
    },
    modalList: {
      maxHeight: 360,
    },
    modalCloseButton: {
      marginTop: spacing.lg,
    },
    warningBox: {
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    warningText: {
      color: colors.accentText,
      fontWeight: fontWeight.black,
    },
    warningInput: {
      borderWidth: 2,
      borderColor: colors.danger,
    },
  });
}