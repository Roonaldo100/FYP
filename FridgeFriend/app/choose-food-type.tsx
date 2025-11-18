import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };

export default function ChooseFoodType() {
  const { barcode, user_id } = useLocalSearchParams<{
    barcode: string;
    user_id: string;
  }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const catRes = await fetch(`${API_BASE_URL}/categories`);
      const ftypeRes = await fetch(`${API_BASE_URL}/foodtypes`);

      setCategories(await catRes.json());
      setFoodTypes(await ftypeRes.json());
      setLoading(false);
    }
    load();
  }, []);

  const handleTypeSelect = async (foodTypeId: number) => {
    try {
      // 1. Create product
      const prodRes = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          food_type: foodTypeId,
        }),
      });

      const { product_id } = await prodRes.json();

      // 2. Add to user inventory
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 5);
      const expiryDate = defaultExpiry.toISOString().split("T")[0];

      await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user_id,
          productId: product_id,
          storeId: 1,
          expiryDate,
        }),
      });

      Alert.alert("Added!", "Item added to your fridge.");
      router.push("/(tabs)");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to add product.");
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Category for Barcode {barcode}</Text>

      {!selectedCategory ? (
        categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.button}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.text}>{cat.name}</Text>
          </TouchableOpacity>
        ))
      ) : (
        foodTypes
          .filter((ft) => ft.category === selectedCategory)
          .map((ft) => (
            <TouchableOpacity
              key={ft.id}
              style={styles.button}
              onPress={() => handleTypeSelect(ft.id)}
            >
              <Text style={styles.text}>{ft.name}</Text>
            </TouchableOpacity>
          ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: "#663399" },
  title: { color: "white", fontSize: 20, marginBottom: 20 },
  button: {
    backgroundColor: "#ffcc00",
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
  },
  text: { color: "#333", fontSize: 18 },
});