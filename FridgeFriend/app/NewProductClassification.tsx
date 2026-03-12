import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { commonStyles } from "../styles/common";
import { buttonStyles } from "../styles/buttons";
import { colors, fontSize, fontWeight, spacing } from "../styles/tokens";

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };

export default function NewProductClassification() {
  const router = useRouter();
  const { user_id, barcode, product_name } =
    useLocalSearchParams<{
      user_id?: string;
      barcode?: string;
      product_name?: string;
    }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);

  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!user_id) return;

    try {
      const res = await fetch(`${API_BASE_URL}/categories?userId=${user_id}`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Categories fetch error:", e);
      setCategories([]);
    }
  }, [user_id]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const title = useMemo(() => {
    const pn = product_name ?? "Unnamed Product";
    if (selectedFoodType) return `Confirm Type for: ${pn}`;
    if (selectedCategory) return `Pick a Food Type for: ${pn}`;
    return `Pick a Category for: ${pn}`;
  }, [product_name, selectedCategory, selectedFoodType]);

  const handleCategoryPress = async (cat: Category) => {
    setLoading(true);
    setSelectedCategory(cat);
    setSelectedFoodType(null);
    setFoodTypes([]);

    try {
      const res = await fetch(`${API_BASE_URL}/categories/${cat.id}/food?userId=${user_id}`);
      const data = await res.json();
      setFoodTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("FoodTypes fetch error:", e);
      setFoodTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!user_id || !barcode || !product_name) {
      Alert.alert("Error", "Missing required information to create product.");
      return;
    }
    if (!selectedFoodType) {
      Alert.alert("Select a Food Type", "Please choose a food type to continue.");
      return;
    }

    setLoading(true);

    try {
      const createResp = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(user_id),
          name: product_name,
          barcode,
          foodTypeId: selectedFoodType.id,
          storeId: null,
        }),
      });

      if (!createResp.ok) {
        const txt = await createResp.text().catch(() => "");
        console.error("Create product failed:", createResp.status, txt);
        Alert.alert("Error", "Failed to create product.");
        return;
      }

      const created = await createResp.json();

      router.push({
        pathname: "/AddItemToFridge",
        params: {
          user_id: String(user_id),
          product_id: String(created.product_id),
          product_name: String(created.product_name ?? product_name),
        },
      });
    } catch (e) {
      console.error("Classification confirm error:", e);
      Alert.alert("Error", "Unable to save product classification.");
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

  const handleBackPress = () => {
    if (selectedFoodType) {
      setSelectedFoodType(null);
      return;
    }
    if (selectedCategory) {
      setSelectedCategory(null);
      setFoodTypes([]);
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.meta}>
        <Text style={styles.metaText}>Barcode: {barcode ?? "Unknown"}</Text>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

      {!loading && (
        <>
          {selectedCategory ? (
            selectedFoodType ? (
              <>
                <View style={[commonStyles.card, styles.confirmCard]}>
                  <Text style={styles.confirmText}>Category: {selectedCategory.name}</Text>
                  <Text style={styles.confirmText}>Food Type: {selectedFoodType.name}</Text>
                </View>

                <TouchableOpacity
                  style={[buttonStyles.base, buttonStyles.light, styles.confirmButton]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
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
              categories.map((cat) => ({ key: String(cat.id), label: cat.name })),
              (idStr) => {
                const cat = categories.find((c) => String(c.id) === idStr);
                if (cat) handleCategoryPress(cat);
              }
            )
          )}
        </>
      )}

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.light, styles.backButton]}
        onPress={handleBackPress}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screenPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.primaryTextOn,
    fontSize: 18,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  meta: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  metaText: {
    color: colors.primaryTextOn,
    fontSize: fontSize.sm,
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
  confirmCard: {
    width: 320,
    marginBottom: spacing.md,
  },
  confirmText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  confirmButton: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
  backButton: {
    marginTop: spacing.xxl,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});