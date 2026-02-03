import React, { useEffect, useMemo, useState } from "react";
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

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };

export default function ManualAddProduct() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);

  const [loading, setLoading] = useState(false);

  // Load categories
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
    if (selectedFoodType) return "Confirm Product";
    if (selectedCategory) return "Choose Food Type";
    return "Add Product Manually";
  }, [selectedCategory, selectedFoodType]);

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
      console.error("Food types fetch error:", e);
      setFoodTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!user_id || !name || !selectedFoodType) {
      Alert.alert("Missing information", "Please complete all required fields.");
      return;
    }

    setLoading(true);

    try {
      // 1) Create product (store is optional so it is not set here)
      const createResp = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          barcode: barcode.trim() ? barcode.trim() : null,
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
          style={styles.button}
          onPress={() => onPress(item.key)}
        >
          <Text style={styles.buttonText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {!selectedCategory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product details</Text>

          <Text style={styles.label}>Product name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Strawberries"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.helperText}>
            This is the name that will appear in your fridge
          </Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Barcode (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Leave blank if unknown"
            value={barcode}
            onChangeText={setBarcode}
            keyboardType="number-pad"
          />

          <Text style={styles.helperText}>
            Only needed if you want to scan this product in the future
          </Text>
        </View>
      )}

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <>
          {selectedCategory ? (
            selectedFoodType ? (
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
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
  title: { color: "white", fontSize: 20, marginBottom: 12 },
  input: {
    width: 280,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
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
  buttonText: { color: "#333", fontSize: 16, fontWeight: "600" },
  confirmButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  confirmButtonText: {
    color: "#663399",
    fontSize: 16,
    fontWeight: "bold",
  },
  section: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#333",
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },

  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});
