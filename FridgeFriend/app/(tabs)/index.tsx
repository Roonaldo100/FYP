import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { API_BASE_URL } from "../../config/apiConfig";

import {
  registerForLocalNotificationsAsync,
  sendImmediateExpiryTestNotification,
} from "../../lib/notifications";

type Category = { id: number; name: string };
type FoodType = { id: number; name: string; category: number };
type UserProduct = {
  product_id: number;
  product_name: string;
  store_name: string;
  quantity: number;
  nearest_expiry: string;
};

export default function Home() {
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/categories`)
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error(err));
  }, []);

  // Poll pending notifications (covers manual SQL inserts)
  useEffect(() => {
    if (!user_id) return;

    (async () => {
      const ok = await registerForLocalNotificationsAsync();
      if (!ok) return;

      try {
        const resp = await fetch(`${API_BASE_URL}/user/${user_id}/pendingNotifications`);
        if (!resp.ok) return;

        const rows: { user_product_id: number; product_name: string }[] = await resp.json();

        for (const row of rows) {
          await sendImmediateExpiryTestNotification(row.product_name);

          await fetch(`${API_BASE_URL}/user_products/${row.user_product_id}/markNotified`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Pending notification poll error:", e);
      }
    })();
  }, [user_id]);

  const handleCategoryPress = async (category: Category) => {
    setLoading(true);
    setSelectedCategory(category);
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${category.id}/food`);
      const data = await res.json();
      setFoodTypes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFoodTypePress = async (foodType: FoodType) => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    setLoading(true);
    setSelectedFoodType(foodType);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${user_id}/foodtype/${foodType.id}`);
      const data = await res.json();
      setUserProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    if (selectedFoodType) {
      setSelectedFoodType(null);
      setUserProducts([]);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setFoodTypes([]);
    }
  };

  const handleScanPress = () => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "/BarcodeScanner",
      params: { user_id: String(user_id) },
    });
  };

  const renderButtons = (items: string[], onPress: (name: string) => void) => (
    <View style={styles.grid}>
      {items.map((name, index) => (
        <TouchableOpacity key={index} style={styles.button} onPress={() => onPress(name)}>
          <Text style={styles.buttonText}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderUserProducts = () => (
    <View style={styles.grid}>
      {userProducts.map((prod, index) => (
        <View key={index} style={styles.productCard}>
          <Text style={styles.productName}>{prod.product_name}</Text>
          <Text style={styles.productDetails}>Store: {prod.store_name}</Text>
          <Text style={styles.productDetails}>Qty: {prod.quantity}</Text>
          <Text style={styles.productDetails}>Expires: {prod.nearest_expiry}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {selectedFoodType
          ? `${selectedFoodType.name} (Your Items)`
          : selectedCategory
          ? `${selectedCategory.name} Types`
          : "Select a Category"}
      </Text>

      <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
        <Text style={styles.scanButtonText}>📷 Scan Item</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading &&
        (selectedFoodType
          ? renderUserProducts()
          : selectedCategory
          ? renderButtons(foodTypes.map((ft) => ft.name), (name) => {
              const ft = foodTypes.find((f) => f.name === name);
              if (ft) handleFoodTypePress(ft);
            })
          : renderButtons(categories.map((cat) => cat.name), (name) => {
              const cat = categories.find((c) => c.name === name);
              if (cat) handleCategoryPress(cat);
            }))}

      {(selectedCategory || selectedFoodType) && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <StatusBar style="auto" />
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
  title: {
    color: "white",
    fontSize: 22,
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  scanButtonText: {
    color: "#663399",
    fontWeight: "bold",
    fontSize: 16,
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
  buttonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
  },
  productCard: {
    backgroundColor: "#fff",
    width: 150,
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: "center",
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  productDetails: {
    fontSize: 14,
    color: "#555",
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#663399",
    fontSize: 16,
    fontWeight: "bold",
  },
});
