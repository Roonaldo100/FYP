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

  // Category -> FoodType picker state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedFoodTypeId, setSelectedFoodTypeId] = useState<number | null>(null);

  // Modals
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [foodTypeModalOpen, setFoodTypeModalOpen] = useState(false);

  // Index for resolving food_type -> (category + name)
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

  // -----------------------------
  // API helpers
  // -----------------------------

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

  /**
   * IMPORTANT:
   * This must match your backend route.
   * Based on your earlier error stack, you already have a "load product" endpoint.
   *
   * If your backend uses a different path, change only these two URLs:
   * - GET  -> load product
   * - PUT  -> save product
   */
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
            food_type: foodTypeId, // <- MUST be food_types.id or null
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

  // -----------------------------
  // Initial load
  // -----------------------------

  useEffect(() => {
    if (!userId || !productId) return;

    (async () => {
      setLoading(true);
      try {
        // 1) load product and categories in parallel
        const [p, cats] = await Promise.all([loadProduct(), loadCategories()]);

        if (!p) {
          setProduct(null);
          setName("");
          return;
        }

        // Block system products if they somehow get here
        if (p.is_system === true) {
          Alert.alert("Not allowed", "System products cannot be edited.");
          router.back();
          return;
        }

        setProduct(p);
        setName(String(p.name ?? ""));

        setCategories(cats);

        // 2) Build a food type index across all categories
        //    so we can resolve p.food_type -> category + names reliably.
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

        // 3) Set initial selections based on product.food_type
        const currentFoodTypeId =
          p.food_type == null ? null : Number(p.food_type);

        if (currentFoodTypeId && index.has(currentFoodTypeId)) {
          const row = index.get(currentFoodTypeId)!;
          setSelectedFoodTypeId(currentFoodTypeId);
          setSelectedCategoryId(row.categoryId);

          // Load visible food types for selected category
          const fts = await loadFoodTypesForCategory(row.categoryId);
          setFoodTypes(fts);
        } else {
          // No food type set
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

  // -----------------------------
  // Picker handlers
  // -----------------------------

  const pickCategory = useCallback(
    async (catId: number) => {
      setCategoryModalOpen(false);

      setSelectedCategoryId(catId);

      // reset food type selection when category changes
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

  // -----------------------------
  // Save
  // -----------------------------

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

      // ✅ Force EditProducts to refresh by replacing route with a refresh token
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

  // -----------------------------
  // UI
  // -----------------------------

  if (!userId || !productId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Edit Product</Text>
        <Text style={styles.errorText}>Missing user_id or product_id.</Text>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtnInline} onPress={() => router.back()}>
          <Text style={styles.backTextInline}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{header}</Text>

      {loading && (
        <View style={{ paddingVertical: 14 }}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.card}>
            <Text style={styles.label}>Product name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Milk"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Category</Text>

            <TouchableOpacity style={styles.pickerBtn} onPress={() => setCategoryModalOpen(true)}>
              <Text style={styles.pickerText}>
                {selectedCategoryName ? selectedCategoryName : "Pick a category"}
              </Text>
              <Text style={styles.pickerChev}>›</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 12 }]}>Food type</Text>

            <TouchableOpacity
              style={[styles.pickerBtn, !selectedCategoryId && { opacity: 0.5 }]}
              onPress={() => selectedCategoryId && setFoodTypeModalOpen(true)}
              disabled={!selectedCategoryId}
            >
              <Text style={styles.pickerText}>
                {selectedFoodTypeName ? selectedFoodTypeName : selectedCategoryId ? "Pick a food type" : "Pick category first"}
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

      {/* Category Modal */}
      <Modal visible={categoryModalOpen} transparent animationType="fade" onRequestClose={() => setCategoryModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select category</Text>

            <FlatList
              data={categories}
              keyExtractor={(c) => `cat_${String(c.id)}`}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => pickCategory(Number(item.id))}>
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No categories found.</Text>}
            />

            <TouchableOpacity style={styles.modalClose} onPress={() => setCategoryModalOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Food Type Modal */}
      <Modal visible={foodTypeModalOpen} transparent animationType="fade" onRequestClose={() => setFoodTypeModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select food type</Text>

            <FlatList
              data={foodTypes}
              keyExtractor={(ft) => `ft_${String(ft.id)}`}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => pickFoodType(Number(item.id))}>
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No food types in this category.</Text>}
            />

            <TouchableOpacity style={styles.modalClose} onPress={() => setFoodTypeModalOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 14, paddingTop: 18 },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  backBtnInline: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backTextInline: { fontWeight: "900", color: "#111" },

  saveBtn: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveText: { color: "#fff", fontWeight: "900" },

  title: { marginTop: 12, fontSize: 20, fontWeight: "900", color: "#111" },

  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
  },

  label: { fontWeight: "900", color: "#111", marginBottom: 8 },

  input: {
    backgroundColor: "#f3f3f3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
  },

  pickerBtn: {
    backgroundColor: "#f3f3f3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontWeight: "800", color: "#111" },
  pickerChev: { fontWeight: "900", color: "#777", fontSize: 18 },

  clearBtn: { marginTop: 10, alignSelf: "flex-start" },
  clearText: { color: "#b00020", fontWeight: "900" },

  errorText: { marginTop: 10, color: "#b00020", fontWeight: "800" },

  backBtn: {
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  backText: { color: "#fff", fontWeight: "900" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111", marginBottom: 10 },

  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalRowText: { fontWeight: "800", color: "#111" },

  modalEmpty: { paddingVertical: 12, color: "#666", fontWeight: "700" },

  modalClose: {
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "900" },
});