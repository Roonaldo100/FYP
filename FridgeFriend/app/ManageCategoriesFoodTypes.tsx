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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  type AppColors,
} from "../styles/tokens";

type Category = {
  id: number;
  name: string;
  is_system?: boolean;
  owner_user_id?: number | null;
};

type FoodType = {
  id: number;
  name: string;
  category: number;
  is_system?: boolean;
  owner_user_id?: number | null;
};

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

function sortProductsAlphabetically(rows: Product[]) {
  return [...rows].sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
      sensitivity: "base",
    })
  );
}

export default function ManageCategoriesFoodTypes() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const { colors, commonStyles, formStyles, buttonStyles, modalStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const userIdNum = useMemo(() => Number(user_id), [user_id]);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"categories" | "foodTypes" | "products">("categories");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [foodTypeNameById, setFoodTypeNameById] = useState<Map<number, string>>(new Map());
  const [foodTypeIndexRows, setFoodTypeIndexRows] = useState<FoodTypeIndexRow[]>([]);
  const [foodTypeFilterId, setFoodTypeFilterId] = useState<number | null>(null);
  const [foodTypeFilterModalOpen, setFoodTypeFilterModalOpen] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newFoodTypeName, setNewFoodTypeName] = useState("");

  const requireUser = useCallback(() => {
    if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("../LoginScreen");
      return false;
    }
    return true;
  }, [router, userIdNum]);

  const loadCategories = useCallback(async () => {
    if (!requireUser()) return;

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/categories?userId=${userIdNum}`);
      const data = await resp.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Load categories error:", e);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [requireUser, userIdNum]);

  const loadFoodTypes = useCallback(
    async (categoryId: number) => {
      if (!requireUser()) return;

      try {
        setLoading(true);
        const resp = await fetch(
          `${API_BASE_URL}/categories/${categoryId}/food?userId=${userIdNum}`
        );
        const data = await resp.json();
        setFoodTypes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Load food types error:", e);
        setFoodTypes([]);
      } finally {
        setLoading(false);
      }
    },
    [requireUser, userIdNum]
  );

  const loadFoodTypesIndex = useCallback(async () => {
    if (!requireUser()) return;

    try {
      const catRes = await fetch(`${API_BASE_URL}/categories?userId=${userIdNum}`);
      if (!catRes.ok) {
        setFoodTypeNameById(new Map());
        setFoodTypeIndexRows([]);
        return;
      }

      const catData = await catRes.json();
      const cats: Category[] = Array.isArray(catData) ? catData : [];
      const map = new Map<number, string>();
      const rows: FoodTypeIndexRow[] = [];

      await Promise.all(
        cats.map(async (cat: Category) => {
          const ftRes = await fetch(
            `${API_BASE_URL}/categories/${cat.id}/food?userId=${userIdNum}`
          );
          if (!ftRes.ok) return;

          const ftData = await ftRes.json();
          const ftRows: FoodType[] = Array.isArray(ftData) ? ftData : [];

          for (const row of ftRows) {
            const id = Number(row.id);
            map.set(id, String(row.name));
            rows.push({
              id,
              name: String(row.name),
              categoryId: Number(cat.id),
              categoryName: String(cat.name),
            });
          }
        })
      );

      rows.sort((a, b) => {
        const catCmp = a.categoryName.localeCompare(b.categoryName, undefined, {
          sensitivity: "base",
        });
        if (catCmp !== 0) return catCmp;
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      });

      setFoodTypeNameById(map);
      setFoodTypeIndexRows(rows);
    } catch (e) {
      console.error("foodTypes index fetch error:", e);
      setFoodTypeNameById(new Map());
      setFoodTypeIndexRows([]);
    }
  }, [requireUser, userIdNum]);

  const loadProducts = useCallback(
    async (queryOverride?: string) => {
      if (!requireUser()) return;

      const q = (queryOverride ?? productQuery).trim();

      try {
        setProductsLoading(true);
        const res = await fetch(
          `${API_BASE_URL}/products/search?q=${encodeURIComponent(
            q
          )}&userId=${encodeURIComponent(String(userIdNum))}&limit=100&offset=0`
        );

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("Load products failed:", res.status, txt);
          setProducts([]);
          return;
        }

        const data = await res.json();
        const arr: Product[] = Array.isArray(data) ? data : [];

        const filtered = arr.filter((p) => {
          const isSystem = p.is_system === true;
          const owner = p.owner_user_id == null ? null : Number(p.owner_user_id);
          return !isSystem && owner === userIdNum;
        });

        setProducts(filtered);
      } catch (e) {
        console.error("Load products error:", e);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    },
    [requireUser, productQuery, userIdNum]
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (mode !== "products") return;
    loadFoodTypesIndex();
    loadProducts();
  }, [mode, loadFoodTypesIndex, loadProducts]);

  useFocusEffect(
    useCallback(() => {
      if (!requireUser()) return;

      loadCategories();

      if (mode === "foodTypes" && selectedCategory) {
        loadFoodTypes(selectedCategory.id);
      }

      if (mode === "products") {
        loadFoodTypesIndex();
        loadProducts();
      }
    }, [
      requireUser,
      loadCategories,
      mode,
      selectedCategory,
      loadFoodTypes,
      loadFoodTypesIndex,
      loadProducts,
    ])
  );

  const handleEditProductsPress = useCallback(() => {
    if (!requireUser()) return;
    setMode("products");
  }, [requireUser]);

  const openFoodTypesForCategory = useCallback(
    async (cat: Category) => {
      if (!requireUser()) return;

      setMode("foodTypes");
      setSelectedCategory(cat);
      await loadFoodTypes(cat.id);
    },
    [requireUser, loadFoodTypes]
  );

  const openEditProduct = useCallback(
    (product: Product) => {
      if (!requireUser()) return;

      router.push({
        pathname: "../EditProduct",
        params: {
          user_id: String(userIdNum),
          product_id: String(product.id),
        },
      });
    },
    [requireUser, router, userIdNum]
  );

  const createCategory = async () => {
    if (!requireUser()) return;

    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter a category name.");
      return;
    }

    try {
      setLoading(true);

      const resp = await fetch(`${API_BASE_URL}/user/${userIdNum}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const text = await resp.text().catch(() => "");
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}

      if (!resp.ok) {
        Alert.alert("Error", data?.message || "Failed to create category.");
        return;
      }

      setNewCategoryName("");
      await loadCategories();
      Alert.alert("Created", `"${name}" added.`);
    } catch (e) {
      console.error("Create category error:", e);
      Alert.alert("Error", "Failed to create category.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (cat: Category) => {
    if (!requireUser()) return;

    if (cat.is_system) {
      Alert.alert("Not allowed", "System categories cannot be deleted.");
      return;
    }

    Alert.alert("Delete category?", `Delete "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);

            const resp = await fetch(
              `${API_BASE_URL}/user/${userIdNum}/categories/${cat.id}`,
              { method: "DELETE" }
            );

            const text = await resp.text().catch(() => "");
            let data: any = null;
            try {
              data = JSON.parse(text);
            } catch {}

            if (!resp.ok) {
              Alert.alert("Error", data?.message || "Failed to delete category.");
              return;
            }

            if (selectedCategory?.id === cat.id) {
              setSelectedCategory(null);
              setFoodTypes([]);
            }

            await loadCategories();
            Alert.alert("Deleted", `"${cat.name}" deleted.`);
          } catch (e) {
            console.error("Delete category error:", e);
            Alert.alert("Error", "Failed to delete category.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const createFoodType = async () => {
    if (!requireUser()) return;

    if (!selectedCategory) {
      Alert.alert("Pick a category", "Select a category first.");
      return;
    }

    const name = newFoodTypeName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter a food type name.");
      return;
    }

    try {
      setLoading(true);

      const resp = await fetch(
        `${API_BASE_URL}/user/${userIdNum}/categories/${selectedCategory.id}/food`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      const text = await resp.text().catch(() => "");
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}

      if (!resp.ok) {
        Alert.alert("Error", data?.message || "Failed to create food type.");
        return;
      }

      setNewFoodTypeName("");
      await loadFoodTypes(selectedCategory.id);
      await loadFoodTypesIndex();
      Alert.alert("Created", `"${name}" added.`);
    } catch (e) {
      console.error("Create food type error:", e);
      Alert.alert("Error", "Failed to create food type.");
    } finally {
      setLoading(false);
    }
  };

  const deleteFoodType = async (ft: FoodType) => {
    if (!requireUser()) return;

    if (ft.is_system) {
      Alert.alert("Not allowed", "System food types cannot be deleted.");
      return;
    }

    Alert.alert("Delete food type?", `Delete "${ft.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);

            const resp = await fetch(
              `${API_BASE_URL}/user/${userIdNum}/foodtypes/${ft.id}`,
              { method: "DELETE" }
            );

            const text = await resp.text().catch(() => "");
            let data: any = null;
            try {
              data = JSON.parse(text);
            } catch {}

            if (!resp.ok) {
              Alert.alert("Error", data?.message || "Failed to delete food type.");
              return;
            }

            if (selectedCategory) await loadFoodTypes(selectedCategory.id);
            await loadFoodTypesIndex();
            Alert.alert("Deleted", `"${ft.name}" deleted.`);
          } catch (e) {
            console.error("Delete food type error:", e);
            Alert.alert("Error", "Failed to delete food type.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const categoryList = useMemo(() => {
    const sys = categories.filter((c) => c.is_system);
    const user = categories.filter((c) => !c.is_system);
    return [...sys, ...user];
  }, [categories]);

  const selectedFoodTypeLabel = useMemo(() => {
    if (foodTypeFilterId === null) return "All food types";
    const row = foodTypeIndexRows.find((ft) => Number(ft.id) === Number(foodTypeFilterId));
    return row ? `${row.categoryName} • ${row.name}` : "Filtered food type";
  }, [foodTypeFilterId, foodTypeIndexRows]);

  const visibleProducts = useMemo(() => {
    let rows = products;

    if (foodTypeFilterId !== null) {
      rows = rows.filter((p) => Number(p.food_type) === Number(foodTypeFilterId));
    }

    return sortProductsAlphabetically(rows);
  }, [products, foodTypeFilterId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Categories & Types</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            mode === "categories" ? styles.toggleBtnActive : styles.toggleBtnInactive,
          ]}
          onPress={() => setMode("categories")}
        >
          <Text style={mode === "categories" ? styles.toggleTextActive : styles.toggleTextInactive}>
            Categories
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            mode === "foodTypes" ? styles.toggleBtnActive : styles.toggleBtnInactive,
          ]}
          onPress={() => setMode("foodTypes")}
        >
          <Text style={mode === "foodTypes" ? styles.toggleTextActive : styles.toggleTextInactive}>
            Food Types
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            mode === "products" ? styles.toggleBtnActive : styles.toggleBtnInactive,
          ]}
          onPress={handleEditProductsPress}
        >
          <Text style={mode === "products" ? styles.toggleTextActive : styles.toggleTextInactive}>
            Edit Products
          </Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

      {!loading && mode === "categories" && (
        <>
          <View style={[commonStyles.card, styles.card]}>
            <Text style={styles.cardTitle}>Create category</Text>
            <TextInput
              style={[formStyles.inputAlt, styles.input]}
              placeholder="e.g. Snacks"
              placeholderTextColor={colors.textLight}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={createCategory}
            >
              <Text style={buttonStyles.primaryText}>Add Category</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {categoryList.map((cat) => (
              <TouchableOpacity
                key={String(cat.id)}
                style={[commonStyles.card, styles.row]}
                activeOpacity={0.85}
                onLongPress={() => openFoodTypesForCategory(cat)}
                delayLongPress={250}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowText}>
                    {cat.name}
                    {cat.is_system ? " (system)" : ""}
                  </Text>
                  <Text style={styles.rowHint}>Long press to manage food types →</Text>
                </View>

                {!cat.is_system && (
                  <TouchableOpacity
                    style={[buttonStyles.base, buttonStyles.danger]}
                    onPress={() => deleteCategory(cat)}
                  >
                    <Text style={buttonStyles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {!loading && mode === "foodTypes" && (
        <>
          <View style={[commonStyles.card, styles.card]}>
            <Text style={styles.cardTitle}>Pick a category</Text>

            <ScrollView
              style={styles.categoryPickerList}
              contentContainerStyle={styles.categoryPickerListContent}
            >
              {categoryList.map((cat) => {
                const selected = selectedCategory?.id === cat.id;

                return (
                  <TouchableOpacity
                    key={String(cat.id)}
                    style={[
                      commonStyles.card,
                      styles.categoryPickerRow,
                      selected && styles.categoryPickerRowSelected,
                    ]}
                    onPress={async () => {
                      setSelectedCategory(cat);
                      await loadFoodTypes(cat.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryPickerText,
                        selected && styles.categoryPickerTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={[commonStyles.card, styles.card]}>
            <Text style={styles.cardTitle}>Create food type</Text>
            <TextInput
              style={[formStyles.inputAlt, styles.input]}
              placeholder="e.g. Yogurt"
              placeholderTextColor={colors.textLight}
              value={newFoodTypeName}
              onChangeText={setNewFoodTypeName}
            />
            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={createFoodType}
            >
              <Text style={buttonStyles.primaryText}>Add Food Type</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {foodTypes.map((ft) => (
              <View key={String(ft.id)} style={[commonStyles.card, styles.row]}>
                <Text style={styles.rowText}>
                  {ft.name}
                  {ft.is_system ? " (system)" : ""}
                </Text>

                {!ft.is_system && (
                  <TouchableOpacity
                    style={[buttonStyles.base, buttonStyles.danger]}
                    onPress={() => deleteFoodType(ft)}
                  >
                    <Text style={buttonStyles.dangerText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {mode === "products" && (
        <>
          <View style={[commonStyles.card, styles.card]}>
            <Text style={styles.cardTitle}>Search products</Text>
            <TextInput
              style={[formStyles.inputAlt, styles.input]}
              placeholder="Search products..."
              placeholderTextColor={colors.textLight}
              value={productQuery}
              onChangeText={setProductQuery}
              autoCapitalize="none"
            />

            <View style={styles.productToolsRow}>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.light, styles.filterBtn]}
                onPress={() => setFoodTypeFilterModalOpen(true)}
              >
                <Text style={styles.filterBtnText}>{selectedFoodTypeLabel}</Text>
              </TouchableOpacity>

              {foodTypeFilterId !== null && (
                <TouchableOpacity
                  style={[buttonStyles.base, buttonStyles.secondary]}
                  onPress={() => setFoodTypeFilterId(null)}
                >
                  <Text style={buttonStyles.secondaryText}>Clear filter</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={() => {
                loadFoodTypesIndex();
                loadProducts();
              }}
            >
              <Text style={buttonStyles.primaryText}>Load Products</Text>
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <ActivityIndicator size="large" style={styles.productsLoader} color={colors.primaryTextOn} />
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {visibleProducts.length ? (
                visibleProducts.map((item) => {
                  const ftName =
                    item.food_type != null
                      ? foodTypeNameById.get(Number(item.food_type)) ?? "Unknown"
                      : "None";

                  return (
                    <TouchableOpacity
                      key={String(item.id)}
                      style={[commonStyles.card, styles.productCard]}
                      activeOpacity={0.85}
                      onPress={() => openEditProduct(item)}
                    >
                      <Text style={styles.productName}>
                        {item.name}
                        {item.is_system ? " (system)" : ""}
                      </Text>
                      <Text style={styles.productMeta}>Food type: {ftName}</Text>
                      <Text style={styles.productHint}>Tap to edit →</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  {products.length ? "No products match this food type." : "No products found."}
                </Text>
              )}
            </ScrollView>
          )}
        </>
      )}

      <Modal
        visible={foodTypeFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFoodTypeFilterModalOpen(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Filter by food type</Text>

            <TouchableOpacity
              style={modalStyles.row}
              onPress={() => {
                setFoodTypeFilterId(null);
                setFoodTypeFilterModalOpen(false);
              }}
            >
              <Text style={modalStyles.rowText}>All food types</Text>
            </TouchableOpacity>

            <ScrollView style={styles.modalList}>
              {foodTypeIndexRows.map((item) => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={modalStyles.row}
                  onPress={() => {
                    setFoodTypeFilterId(item.id);
                    setFoodTypeFilterModalOpen(false);
                  }}
                >
                  <Text style={modalStyles.rowText}>
                    {item.categoryName} • {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary, styles.modalCloseBtn]}
              onPress={() => setFoodTypeFilterModalOpen(false)}
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
    container: {
      flex: 1,
      padding: spacing.xl,
      paddingTop: 18,
      backgroundColor: colors.surfaceMuted,
    },
    title: {
      fontSize: 22,
      fontWeight: fontWeight.black,
      marginBottom: spacing.md,
      color: colors.text,
    },
    toggleRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
      marginBottom: spacing.md,
      flexWrap: "wrap",
    },
    toggleBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    toggleBtnInactive: {
      backgroundColor: colors.surfaceAlt,
    },
    toggleBtnActive: {
      backgroundColor: colors.primary,
    },
    toggleTextInactive: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    toggleTextActive: {
      color: colors.primaryTextOn,
      fontWeight: fontWeight.black,
    },
    card: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    cardTitle: {
      fontWeight: fontWeight.black,
      marginBottom: spacing.sm,
      color: colors.text,
    },
    input: {
      marginBottom: 0,
    },
    list: {
      marginTop: spacing.md,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    row: {
      marginBottom: spacing.sm,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md,
    },
    rowText: {
      fontWeight: fontWeight.heavy,
      flex: 1,
      color: colors.text,
    },
    productsLoader: {
      marginTop: spacing.xxl,
    },
    productCard: {
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    productName: {
      fontWeight: fontWeight.black,
      color: colors.text,
      fontSize: 15,
    },
    productMeta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    productHint: {
      marginTop: spacing.sm,
      color: colors.primary,
      fontWeight: fontWeight.black,
      fontSize: fontSize.xs,
    },
    emptyText: {
      marginTop: spacing.lg,
      color: colors.textMuted,
    },
    categoryPickerList: {
      maxHeight: 220,
    },
    categoryPickerListContent: {
      paddingBottom: spacing.sm,
    },
    categoryPickerRow: {
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    categoryPickerRowSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryPickerText: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },
    categoryPickerTextSelected: {
      color: colors.primaryTextOn,
    },
    rowMain: {
      flex: 1,
    },
    rowHint: {
      marginTop: spacing.xs,
      color: colors.primary,
      fontWeight: fontWeight.black,
      fontSize: fontSize.xs,
    },
    productToolsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
      marginTop: spacing.md,
    },
    filterBtn: {
      flexShrink: 1,
    },
    filterBtnText: {
      color: colors.primary,
      fontWeight: fontWeight.black,
    },
    modalList: {
      maxHeight: 320,
    },
    modalCloseBtn: {
      marginTop: spacing.md,
    },
  });
}