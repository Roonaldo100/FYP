import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { useAppStyles } from "../lib/useAppStyles";
import { fontWeight, radius, spacing, type AppColors } from "../styles/tokens";

function toValidId(v: string | string[] | undefined): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = raw == null || String(raw).trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
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

  const { colors, commonStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);
  const productId = useMemo(() => toValidId(params.product_id), [params.product_id]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const deleteProduct = useCallback(async () => {
    if (!userId || !productId) return;

    const res = await fetch(
      `${API_BASE_URL}/user/${encodeURIComponent(String(userId))}/products/${encodeURIComponent(
        String(productId)
      )}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!res.ok) {
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (res.status === 409 && payload) {
        const details = [
          `Inventory: ${payload.inventoryCount ?? 0}`,
          `Shopping lists: ${payload.shoppingCount ?? 0}`,
          `Price history: ${payload.priceCount ?? 0}`,
          `Store links: ${payload.storeLinkCount ?? 0}`,
          `Usage rows: ${payload.usageCount ?? 0}`,
        ].join("\n");

        throw new Error(
          `${payload.message || "This product is still in use."}\n\n${details}`
        );
      }

      const txt =
        payload?.message ||
        (await res.text().catch(() => "")) ||
        `HTTP ${res.status}`;

      throw new Error(txt);
    }
  }, [userId, productId]);

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
        pathname: "/ManageCategoriesFoodTypes",
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

  const onDelete = async () => {
    if (!userId || !productId || !product) return;

    Alert.alert(
      "Delete product?",
      `Delete "${product.name}"?\n\nThis will also remove it from inventory, shopping lists, price history, store links, and usage data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteProduct();

              Alert.alert("Deleted", "Product deleted successfully.");
              router.replace({
                pathname: "/ManageCategoriesFoodTypes",
                params: {
                  user_id: String(userId),
                  refresh: String(Date.now()),
                },
              });
            } catch (e: any) {
              console.error("delete product error:", e);
              Alert.alert("Could not delete product", e?.message || "Delete failed.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
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
          style={[buttonStyles.base, buttonStyles.primary, styles.backButton]}
          onPress={() => router.back()}
        >
          <Text style={buttonStyles.primaryText}>← Back</Text>
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

        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.danger, deleting && styles.dimmed]}
            onPress={onDelete}
            disabled={saving || deleting}
          >
            <Text style={buttonStyles.dangerText}>
              {deleting ? "Deleting…" : "Delete"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.primary, saving && styles.dimmed]}
            onPress={onSave}
            disabled={saving || deleting}
          >
            <Text style={buttonStyles.primaryText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>{header}</Text>

      {loading && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primaryTextOn} />
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
              placeholderTextColor={colors.textLight}
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
              <Text style={styles.clearBtnText}>Clear food type</Text>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select category</Text>

            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => pickCategory(Number(item.id))}
                >
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={() => setCategoryModalOpen(false)}
            >
              <Text style={buttonStyles.primaryText}>Close</Text>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select food type</Text>

            <FlatList
              data={foodTypes}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => pickFoodType(Number(item.id))}
                >
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[buttonStyles.base, buttonStyles.primary]}
              onPress={() => setFoodTypeModalOpen(false)}
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
      backgroundColor: colors.primary,
      padding: spacing.lg,
    },
    topRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
    },
    rightActions: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    inlineBackBtn: {
      paddingHorizontal: spacing.md,
    },
    inlineBackText: {
      color: colors.primary,
      fontWeight: fontWeight.bold,
    },
    title: {
      color: colors.primaryTextOn,
      fontSize: 22,
      fontWeight: fontWeight.black,
      marginTop: spacing.md,
    },
    errorText: {
      color: colors.primaryTextOn,
      marginTop: spacing.md,
    },
    loaderWrap: {
      marginTop: spacing.xl,
      alignItems: "center",
    },
    scrollContent: {
      paddingTop: spacing.lg,
      paddingBottom: 40,
    },
    card: {
      marginBottom: spacing.lg,
    },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
    },
    pickerBtn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    pickerText: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
    pickerChev: {
      color: colors.text,
      fontSize: 22,
      fontWeight: fontWeight.bold,
    },
    disabledPicker: {
      opacity: 0.5,
    },
    secondLabel: {
      marginTop: spacing.lg,
    },
    clearBtn: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    clearBtnText: {
      color: colors.text,
      fontWeight: fontWeight.bold,
    },
    backButton: {
      marginTop: spacing.lg,
      alignSelf: "flex-start",
    },
    dimmed: {
      opacity: 0.6,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      maxHeight: "70%",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: fontWeight.black,
      color: colors.text,
      marginBottom: spacing.md,
    },
    modalRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalRowText: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
  });
}