import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { colors, fontSize, fontWeight, spacing } from "../styles/tokens";

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ManualAddProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    prefill_name?: string;
    prefill_store_id?: string;
    prefill_store_name?: string;
    prefill_quantity?: string;
    from_shopping_list?: string;
    listId?: string;
    itemId?: string;
  }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const fromShopping = params.from_shopping_list === "1";
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);
  const itemId = useMemo(() => toValidId(params.itemId), [params.itemId]);

  const prefillQty = useMemo(() => {
    const n = Number(params.prefill_quantity ?? 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [params.prefill_quantity]);

  const prefillStoreId = useMemo(() => {
    const s = String(params.prefill_store_id ?? "");
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [params.prefill_store_id]);

  const [name, setName] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.prefill_name && !name) setName(String(params.prefill_name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = useCallback(async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/categories?userId=${userId}`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Categories fetch error:", e);
      setCategories([]);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const title = useMemo(() => {
    if (selectedFoodType) return "Confirm Product";
    if (selectedCategory) return "Choose Food Type";
    return fromShopping ? "Create Product (from shopping list)" : "Add Product Manually";
  }, [selectedCategory, selectedFoodType, fromShopping]);

  const handleSettingsPress = () => {
    if (!userId) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "/Settings",
      params: { user_id: String(userId) },
    });
  };

  const handleManageTypesPress = () => {
    if (!userId) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "/ManageCategoriesFoodTypes",
      params: { user_id: String(userId) },
    });
  };

  const handleCategoryPress = async (cat: Category) => {
    if (!userId) return;

    setLoading(true);
    setSelectedCategory(cat);
    setSelectedFoodType(null);
    setFoodTypes([]);

    try {
      const res = await fetch(`${API_BASE_URL}/categories/${cat.id}/food?userId=${userId}`);
      const data = await res.json();
      setFoodTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Food types fetch error:", e);
      setFoodTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const addToInventoryQty = async (productId: number) => {
    if (!userId) return;

    for (let i = 0; i < prefillQty; i++) {
      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          productId,
          storeId: prefillStoreId,
          expiryDate: null,
          price: null,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `HTTP ${resp.status}`);
      }
    }
  };

  const markShoppingItemAsResolved = async (productId: number) => {
    if (!fromShopping || !userId || !listId || !itemId) return;

    const res = await fetch(
      `${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}/attachProduct`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          storeId: prefillStoreId,
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `HTTP ${res.status}`);
    }
  };

  const handleConfirm = async () => {
    if (!userId || !name || !selectedFoodType) {
      Alert.alert("Missing information", "Please complete all required fields.");
      return;
    }

    setLoading(true);

    try {
      const createResp = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          name,
          foodTypeId: selectedFoodType.id,
          storeId: prefillStoreId,
          allowExisting: false,
        }),
      });

      if (!createResp.ok) {
        const txt = await createResp.text().catch(() => "");
        console.error("Create product failed:", createResp.status, txt);
        Alert.alert("Error", "Failed to create product.");
        return;
      }

      const created = await createResp.json();

      const pid = Number(created.product_id);

      if (fromShopping) {
        await markShoppingItemAsResolved(pid);
        await addToInventoryQty(pid);
        router.back();
        return;
      }

      router.push({
        pathname: "/AddItemToFridge",
        params: {
          user_id: String(userId),
          product_id: String(pid),
          product_name: String(created.product_name ?? name),
        },
      });
    } catch (e) {
      console.error("Manual add error:", e);
      Alert.alert("Error", "Unable to add product.");
    } finally {
      setLoading(false);
    }
  };

  const renderButtons = (
    items: { key: string; label: string }[],
    onPress: (key: string) => void
  ) => (
    <View style={styles.grid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[buttonStyles.gridButton, buttonStyles.accent]}
          onPress={() => onPress(item.key)}
        >
          <Text style={styles.gridButtonText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
            onPress={handleSettingsPress}
          >
            <Text style={styles.topButtonText}>⚙️ Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
            onPress={handleManageTypesPress}
          >
            <Text style={styles.topButtonText}>Manage Types</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{title}</Text>

        {!selectedCategory && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Product details</Text>

            <Text style={commonStyles.label}>Product name *</Text>
            <TextInput
              style={[formStyles.input, formStyles.inputWide]}
              placeholder="e.g. Strawberries"
              value={name}
              onChangeText={setName}
            />

            <Text style={commonStyles.helperText}>
              This is the name that will appear in your fridge
            </Text>

            {fromShopping && (
              <Text style={[commonStyles.helperText, styles.shoppingPrefill]}>
                From shopping list: Qty {prefillQty} • Store {params.prefill_store_name ?? "No store"}
              </Text>
            )}
          </View>
        )}

        {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

        {!loading && (
          <>
            {selectedCategory ? (
              selectedFoodType ? (
                <TouchableOpacity
                  style={[buttonStyles.base, buttonStyles.light, styles.confirmButton]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>Continue</Text>
                </TouchableOpacity>
              ) : (
                renderButtons(
                  foodTypes.map((ft) => ({ key: String(ft.id), label: ft.name })),
                  (idStr) => {
                    const ft = foodTypes.find((f) => String(f.id) === idStr);
                    if (ft) setSelectedFoodType(ft);
                  }
                )
              )
            ) : (
              renderButtons(
                categories.map((c) => ({ key: String(c.id), label: c.name })),
                (idStr) => {
                  const cat = categories.find((c) => String(c.id) === idStr);
                  if (cat) handleCategoryPress(cat);
                }
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screenPrimary,
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
  },
  topRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  topButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  topButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.heavy,
    fontSize: fontSize.sm,
  },
  title: {
    color: colors.primaryTextOn,
    fontSize: 20,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  subLabel: {
    marginTop: spacing.lg,
  },
  shoppingPrefill: {
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: 320,
  },
  gridButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  confirmButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});