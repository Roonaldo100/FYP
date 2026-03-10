// app/ManageCategoriesFoodTypes.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

export default function ManageCategoriesFoodTypes() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const userIdNum = useMemo(() => Number(user_id), [user_id]);

  const [loading, setLoading] = useState(false);

  // View state
  const [mode, setMode] = useState<"categories" | "foodTypes">("categories");

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);

  // Inputs
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

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // -------------------------
  // Edit products navigation
  // -------------------------
  const handleEditProductsPress = useCallback(() => {
    if (!requireUser()) return;

    router.push({
      pathname: "../EditProducts",
      params: { user_id: String(userIdNum) },
    });
  }, [requireUser, router, userIdNum]);

  // -------------------------
  // Create / delete category
  // -------------------------
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

            // if we deleted the selected category, clear it
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

  // -------------------------
  // Create / delete food type
  // -------------------------
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

  // -------------------------
  // UI helpers
  // -------------------------
  const categoryList = useMemo(() => {
    const sys = categories.filter((c) => c.is_system);
    const user = categories.filter((c) => !c.is_system);
    return [...sys, ...user];
  }, [categories]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Categories & Types</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "categories" && styles.toggleBtnActive]}
          onPress={() => setMode("categories")}
        >
          <Text style={[styles.toggleText, mode === "categories" && styles.toggleTextActive]}>
            Categories
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, mode === "foodTypes" && styles.toggleBtnActive]}
          onPress={() => setMode("foodTypes")}
        >
          <Text style={[styles.toggleText, mode === "foodTypes" && styles.toggleTextActive]}>
            Food Types
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleEditProductsPress}>
          <Text style={styles.primaryBtnText}>Edit Products</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" />}

      {!loading && mode === "categories" && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Snacks"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={createCategory}>
              <Text style={styles.primaryBtnText}>Add Category</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
            {categoryList.map((cat) => (
              <View key={String(cat.id)} style={styles.row}>
                <Text style={styles.rowText}>
                  {cat.name} {cat.is_system ? " (system)" : ""}
                </Text>

                {!cat.is_system && (
                  <TouchableOpacity style={styles.dangerBtn} onPress={() => deleteCategory(cat)}>
                    <Text style={styles.dangerBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {!loading && mode === "foodTypes" && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pick a category</Text>

            <ScrollView horizontal contentContainerStyle={{ paddingVertical: 8 }}>
              {categoryList.map((cat) => {
                const selected = selectedCategory?.id === cat.id;
                return (
                  <TouchableOpacity
                    key={String(cat.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={async () => {
                      setSelectedCategory(cat);
                      await loadFoodTypes(cat.id);
                    }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create food type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Yogurt"
              value={newFoodTypeName}
              onChangeText={setNewFoodTypeName}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={createFoodType}>
              <Text style={styles.primaryBtnText}>Add Food Type</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
            {foodTypes.map((ft) => (
              <View key={String(ft.id)} style={styles.row}>
                <Text style={styles.rowText}>
                  {ft.name} {ft.is_system ? " (system)" : ""}
                </Text>

                {!ft.is_system && (
                  <TouchableOpacity style={styles.dangerBtn} onPress={() => deleteFoodType(ft)}>
                    <Text style={styles.dangerBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 18, backgroundColor: "#fafafa" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 10 },

  toggleRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" },
  toggleBtn: { backgroundColor: "#eee", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: "#111" },
  toggleText: { fontWeight: "900", color: "#111" },
  toggleTextActive: { color: "#fff" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee", marginTop: 10 },
  cardTitle: { fontWeight: "900", marginBottom: 8 },

  input: { backgroundColor: "#eee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },

  primaryBtn: { backgroundColor: "#111", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "900", textAlign: "center" },

  list: { marginTop: 10 },
  row: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee", marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  rowText: { fontWeight: "800", flex: 1 },

  dangerBtn: { backgroundColor: "#b00020", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  dangerBtnText: { color: "#fff", fontWeight: "900" },

  chip: { backgroundColor: "#eee", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  chipSelected: { backgroundColor: "#111" },
  chipText: { fontWeight: "900", color: "#111" },
  chipTextSelected: { color: "#fff" },
});