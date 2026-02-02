import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../../config/apiConfig";

import {
  registerForLocalNotificationsAsync,
  sendExpiryNotification,
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

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(
    null
  );

  const [loading, setLoading] = useState<boolean>(false);

  // -------------------------------
  // Load categories (app boot)
  // -------------------------------
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

  // -------------------------------
  // Poll due notifications (DB-driven)
  // -------------------------------
  const pollPendingNotifications = useCallback(async () => {
    if (!user_id) return;

    const ok = await registerForLocalNotificationsAsync();
    if (!ok) return;

    try {
      const resp = await fetch(
        `${API_BASE_URL}/user/${user_id}/pendingNotifications`
      );
      if (!resp.ok) return;

      const rows: {
        user_product_id: number;
        product_name: string;
        days_left: number;
        effective_period_days: number;
      }[] = await resp.json();

      for (const row of rows) {
        await sendExpiryNotification(row.product_name, Number(row.days_left));

        await fetch(
          `${API_BASE_URL}/user_products/${row.user_product_id}/markNotified`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (e) {
      console.error("Pending notification poll error:", e);
    }
  }, [user_id]);

  // Run when Home gains focus (covers “back and re-enter” behaviour)
  useFocusEffect(
    useCallback(() => {
      pollPendingNotifications();
    }, [pollPendingNotifications])
  );

  // -------------------------------
  // Navigation + data loading
  // -------------------------------
  const handleCategoryPress = async (category: Category) => {
    setLoading(true);
    setSelectedCategory(category);
    setSelectedFoodType(null);
    setUserProducts([]);

    try {
      const res = await fetch(`${API_BASE_URL}/categories/${category.id}/food`);
      const data = await res.json();
      setFoodTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("FoodTypes fetch error:", e);
      setFoodTypes([]);
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
      const res = await fetch(
        `${API_BASE_URL}/user/${user_id}/foodtype/${foodType.id}`
      );
      const data = await res.json();
      setUserProducts(Array.isArray(data) ? data : []);

      // Also poll here (covers “back then re-enter strawberries”)
      await pollPendingNotifications();
    } catch (e) {
      console.error("UserProducts fetch error:", e);
      setUserProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = async () => {
    if (selectedFoodType) {
      setSelectedFoodType(null);
      setUserProducts([]);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setFoodTypes([]);
    }

    // optional: poll again
    await pollPendingNotifications();
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

  // -------------------------------
  // Render helpers (RESTORED)
  // -------------------------------
  const title = useMemo(() => {
    if (selectedFoodType) return `${selectedFoodType.name} (Your Items)`;
    if (selectedCategory) return `${selectedCategory.name} Types`;
    return "Select a Category";
  }, [selectedCategory, selectedFoodType]);

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

  const renderUserProducts = () => (
    <View style={styles.grid}>
      {userProducts.map((prod, idx) => (
        <View key={`${prod.product_id}-${idx}`} style={styles.productCard}>
          <Text style={styles.productName}>{prod.product_name}</Text>
          <Text style={styles.productDetails}>Store: {prod.store_name}</Text>
          <Text style={styles.productDetails}>Qty: {prod.quantity}</Text>
          <Text style={styles.productDetails}>Expires: {prod.nearest_expiry}</Text>
        </View>
      ))}
    </View>
  );

  // -------------------------------
  // Main render (RESTORED)
  // -------------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
        <Text style={styles.scanButtonText}>📷 Scan Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() =>
          router.push({
            pathname: "/ManualAddProduct",
            params: { user_id: String(user_id) },
          })
        }
      >
        <Text style={styles.scanButtonText}>➕ Add Item Manually</Text>
      </TouchableOpacity>


      {loading && <ActivityIndicator size="large" color="#fff" />}

      {!loading && (
        <>
          {selectedFoodType ? (
            renderUserProducts()
          ) : selectedCategory ? (
            renderButtons(
              foodTypes.map((ft) => ({ key: String(ft.id), label: ft.name })),
              (idStr) => {
                const ft = foodTypes.find((f) => String(f.id) === idStr);
                if (ft) handleFoodTypePress(ft);
              }
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
  title: { color: "white", fontSize: 22, marginBottom: 20 },
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
  buttonText: { color: "#333", fontSize: 18, fontWeight: "600" },
  productCard: {
    backgroundColor: "#fff",
    width: 150,
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: "center",
  },
  productName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  productDetails: { fontSize: 14, color: "#555" },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  backButtonText: { color: "#663399", fontSize: 16, fontWeight: "bold" },
});
