import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { modalStyles } from "../styles/modals";
import { colors, fontSize, fontWeight, radius, spacing } from "../styles/tokens";

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };

type Product = {
  id: number;
  name: string;
  food_type: number | null;
  is_system?: boolean;
  owner_user_id?: number | null;
};

type FoodTypeIndexRow = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
};

export default function EditProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string; product_id?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const productId = useMemo(() => toValidId(params.product_id), [params.product_id]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedFoodTypeId, setSelectedFoodTypeId] = useState<number | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [foodTypeModalOpen, setFoodTypeModalOpen] = useState(false);

  const [foodTypeIndex, setFoodTypeIndex] = useState<Map<number, FoodTypeIndexRow>>(new Map());

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    const c = categories.find((x) => Number(x.id) === Number(selectedCategoryId));
    return c?.name ?? null;
  }, [categories, selectedCategoryId]);

  const selectedFoodTypeName = useMemo(() => {
    if (!selectedFoodTypeId) return null;
    const ft = foodTypeIndex.get(Number(selectedFoodTypeId));
    return ft?.name ?? null;
  }, [foodTypeIndex, selectedFoodTypeId]);

  const loadCategories = useCallback(async (): Promise<Category[]> => {
    if (!userId) return [];
    const res = await fetch(
      `${API_BASE_URL}/categories?userId=${encodeURIComponent(String(userId))}`
    );
    const data = await res.json();
    return Array.isArray(data) ? (data as Category[]) : [];
  }, [userId]);

  const loadFoodTypesForCategory = useCallback(
    async (categoryId: number): Promise<FoodType[]> => {
      if (!userId) return [];
      const res = await fetch(
        `${API_BASE_URL}/categories/${encodeURIComponent(String(categoryId))}/food?userId=${encodeURIComponent(
          String(userId)
        )}`
      );
      const data = await res.json();
      return Array.isArray(data) ? (data as FoodType[]) : [];
    },
    [userId]
  );

  const loadProduct = useCallback(async () => {
    if (!userId || !productId) return null;

    const res = await fetch(
      `${API_BASE_URL}/user/${encodeURIComponent(String(userId))}/products/${encodeURIComponent(
        String(productId)
      )}`
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data as Product;
  }, [userId, productId]);

  const saveProduct = useCallback(
    async (newName: string, foodTypeId: number | null) => {
      if (!userId || !productId) return;

      const res = await fetch(
        `${API_BASE_URL}/user/${encodeURIComponent(String(userId))}/products/${encodeURIComponent(
          String(productId)
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            food_type: foodTypeId,
          }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
    },
    [userId, productId]
  );

  useEffect(() => {
    if (!userId || !productId) return;

    (async () => {
      setLoading(true);
      try {
        const [p, cats] = await Promise.all([loadProduct(), loadCategories()]);

        if (!p) {
          setProduct(null);
          setName("");
          return;
        }

        if (p.is_system === true) {
          Alert.alert("Not allowed", "System products cannot be edited.");
          router.back();
          return;
        }

        setProduct(p);
        setName(String(p.name ?? ""));
        setCategories(cats);

        const index = new Map<number, FoodTypeIndexRow>();
        await Promise.all(
          cats.map(async (c) => {
            const fts = await loadFoodTypesForCategory(Number(c.id));
            for (const ft of fts) {
              const id = Number(ft.id);
              if (!Number.isFinite(id)) continue;
              index.set(id, {
                id,
                name: String(ft.name),
                categoryId: Number(c.id),
                categoryName: String(c.name),
              });
            }
          })
        );
        setFoodTypeIndex(index);

        const currentFoodTypeId = p.food_type == null ? null : Number(p.food_type);

        if (currentFoodTypeId && index.has(currentFoodTypeId)) {
          const row = index.get(currentFoodTypeId)!;
          setSelectedFoodTypeId(currentFoodTypeId);
          setSelectedCategoryId(row.categoryId);

          const fts = await loadFoodTypesForCategory(row.categoryId);
          setFoodTypes(fts);
        } else {
          setSelectedFoodTypeId(null);
          setSelectedCategoryId(null);
          setFoodTypes([]);
        }
      } catch (e: any) {
        console.error("load product error:", e);
        Alert.alert("Error", "Could not load product.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, productId, loadProduct, loadCategories, loadFoodTypesForCategory, router]);

  const pickCategory = useCallback(
    async (catId: number) => {
      setCategoryModalOpen(false);
      setSelectedCategoryId(catId);
      setSelectedFoodTypeId(null);

      try {
        setLoading(true);
        const fts = await loadFoodTypesForCategory(catId);
        setFoodTypes(fts);
      } catch (e) {
        console.error("load food types error:", e);
        setFoodTypes([]);
      } finally {
        setLoading(false);
      }
    },
    [loadFoodTypesForCategory]
  );

  const pickFoodType = (ftId: number | null) => {
    setFoodTypeModalOpen(false);
    setSelectedFoodTypeId(ftId);
  };

  const onSave = async () => {
    if (!userId || !productId) {
      Alert.alert("Error", "Missing required information.");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Missing name", "Enter a product name.");
      return;
    }

    try {
      setSaving(true);
      await saveProduct(trimmed, selectedFoodTypeId ?? null);

      router.replace({
        pathname: "/EditProducts",
        params: {
          user_id: String(userId),
          refresh: String(Date.now()),
        },
      });
    } catch (e: any) {
      console.error("save product error:", e);
      Alert.alert("Error", "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const header = useMemo(() => {
    if (!product) return "Edit Product";
    return `Edit: ${product.name ?? "Product"}`;
  }, [product]);

  if (!userId || !productId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Edit Product</Text>
        <Text style={styles.errorText}>Missing user_id or product_id.</Text>

        <TouchableOpacity
          style={[buttonStyles.base, styles.darkButton, styles.backButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.darkButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.inlineBackBtn]}
          onPress={() => router.back()}
        >
          <Text style={styles.inlineBackText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, styles.darkButton, saving && styles.dimmed]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.darkButtonText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{header}</Text>

      {loading && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[commonStyles.card, styles.card]}>
            <Text style={commonStyles.label}>Product name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Milk"
              autoCapitalize="words"
            />
          </View>

          <View style={[commonStyles.card, styles.card]}>
            <Text style={commonStyles.label}>Category</Text>

            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setCategoryModalOpen(true)}
            >
              <Text style={styles.pickerText}>
                {selectedCategoryName ? selectedCategoryName : "Pick a category"}
              </Text>
              <Text style={styles.pickerChev}>›</Text>
            </TouchableOpacity>

            <Text style={[commonStyles.label, styles.secondLabel]}>Food type</Text>

            <TouchableOpacity
              style={[styles.pickerBtn, !selectedCategoryId && styles.disabledPicker]}
              onPress={() => selectedCategoryId && setFoodTypeModalOpen(true)}
              disabled={!selectedCategoryId}
            >
              <Text style={styles.pickerText}>
                {selectedFoodTypeName
                  ? selectedFoodTypeName
                  : selectedCategoryId
                  ? "Pick a food type"
                  : "Pick category first"}
              </Text>
              <Text style={styles.pickerChev}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSelectedFoodTypeId(null);
              }}
            >
              <Text style={styles.clearText}>Clear food type (None)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={categoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalOpen(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Select category</Text>

            <FlatList
              data={categories}
              keyExtractor={(c) => `cat_${String(c.id)}`}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.row}
                  onPress={() => pickCategory(Number(item.id))}
                >
                  <Text style={modalStyles.rowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No categories found.</Text>
              }
            />

            <TouchableOpacity
              style={[buttonStyles.base, styles.darkButton, styles.modalCloseBtn]}
              onPress={() => setCategoryModalOpen(false)}
            >
              <Text style={styles.darkButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={foodTypeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFoodTypeModalOpen(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Select food type</Text>

            <FlatList
              data={foodTypes}
              keyExtractor={(ft) => `ft_${String(ft.id)}`}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.row}
                  onPress={() => pickFoodType(Number(item.id))}
                >
                  <Text style={modalStyles.rowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No food types in this category.</Text>
              }
            />

            <TouchableOpacity
              style={[buttonStyles.base, styles.darkButton, styles.modalCloseBtn]}
              onPress={() => setFoodTypeModalOpen(false)}
            >
              <Text style={styles.darkButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xl,
    paddingTop: 18,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineBackBtn: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  inlineBackText: {
    fontWeight: fontWeight.black,
    color: "#111",
  },
  darkButton: {
    backgroundColor: "#111",
  },
  darkButtonText: {
    color: colors.primaryTextOn,
    fontWeight: fontWeight.black,
  },
  dimmed: {
    opacity: 0.6,
  },
  title: {
    marginTop: spacing.md,
    fontSize: 20,
    fontWeight: fontWeight.black,
    color: "#111",
  },
  loaderWrap: {
    paddingVertical: spacing.xl,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  card: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  input: {
    backgroundColor: "#f3f3f3",
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontWeight: fontWeight.bold,
    color: "#111",
  },
  pickerBtn: {
    backgroundColor: "#f3f3f3",
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: {
    fontWeight: fontWeight.heavy,
    color: "#111",
  },
  pickerChev: {
    fontWeight: fontWeight.black,
    color: "#777",
    fontSize: 18,
  },
  secondLabel: {
    marginTop: spacing.lg,
  },
  disabledPicker: {
    opacity: 0.5,
  },
  clearBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  clearText: {
    color: colors.danger,
    fontWeight: fontWeight.black,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.danger,
    fontWeight: fontWeight.heavy,
  },
  backButton: {
    marginTop: spacing.md,
  },
  modalList: {
    maxHeight: 420,
  },
  modalEmpty: {
    paddingVertical: spacing.lg,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  modalCloseBtn: {
    marginTop: spacing.lg,
  },
});