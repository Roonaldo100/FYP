import React, { useEffect, useMemo, useState } from "react";
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

  // Load categories once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/categories`);
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Categories fetch error:", e);
        setCategories([]);
      }
    })();
  }, []);

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
      const res = await fetch(`${API_BASE_URL}/categories/${cat.id}/food`);
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
      // 1) Create product in DB with chosen food type
      const createResp = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      // 2) Route to optional store/expiry screen
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
          style={styles.button}
          onPress={() => onPress(item.key)}
        >
          <Text style={styles.buttonText}>{item.label}</Text>
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

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <>
          {selectedCategory ? (
            selectedFoodType ? (
              <>
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmText}>Category: {selectedCategory.name}</Text>
                  <Text style={styles.confirmText}>Food Type: {selectedFoodType.name}</Text>
                </View>

                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
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

      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#663399",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { color: "white", fontSize: 18, marginBottom: 12, textAlign: "center" },
  meta: { marginBottom: 12, alignItems: "center" },
  metaText: { color: "white", fontSize: 14 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: 320,
  },
  button: {
    backgroundColor: "#ffcc00",
    width: 150,
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    margin: 5,
  },
  buttonText: { color: "#333", fontSize: 16, fontWeight: "600", textAlign: "center" },

  confirmCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    width: 320,
    marginBottom: 10,
  },
  confirmText: { color: "#333", fontSize: 16, fontWeight: "600" },

  confirmButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  confirmButtonText: {
    color: "#663399",
    fontWeight: "bold",
    fontSize: 16,
  },

  backButton: {
    marginTop: 18,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  backButtonText: { color: "#663399", fontSize: 16, fontWeight: "bold" },
});
