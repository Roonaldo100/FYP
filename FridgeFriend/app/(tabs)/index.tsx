import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
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
  store_id: number | null;
  store_name: string | null;
  quantity: number;
  nearest_expiry: string | null;
  last_price?: number | null;
};
type ExpiringSoonRow = {
  product_id: number;
  product_name: string;
  store_id: number | null;
  store_name: string | null;
  quantity: number;
  nearest_expiry: string;
  days_left: number;
  effective_period_days: number;
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

  const [expiringSoon, setExpiringSoon] = useState<ExpiringSoonRow[]>([]);

  // -------------------------------
  // Load categories (app boot / focus)
  // -------------------------------
  const loadCategories = useCallback(async () => {
    if (!user_id) return;

    try {
      const res = await fetch(`${API_BASE_URL}/categories?userId=${user_id}`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Categories fetch error:", e);
      setCategories([]);
    }
  }, [user_id]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

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

  // Run when Home gains focus
  useFocusEffect(
    useCallback(() => {
      pollPendingNotifications();
    }, [pollPendingNotifications])
  );

  // -------------------------------
  // Settings navigation
  // -------------------------------
  const handleSettingsPress = () => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "../Settings",
      params: { user_id: String(user_id) },
    });
  };

  // -------------------------------
  // Navigation + data loading
  // -------------------------------
  const handleCategoryPress = async (category: Category) => {
    setLoading(true);
    setSelectedCategory(category);
    setSelectedFoodType(null);
    setUserProducts([]);

    try {
      const res = await fetch(
        `${API_BASE_URL}/categories/${category.id}/food?userId=${user_id}`
      );
      const data = await res.json();
      setFoodTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("FoodTypes fetch error:", e);
      setFoodTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFoodTypePress = useCallback(
    async (foodType: FoodType) => {
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

        await pollPendingNotifications();
      } catch (e) {
        console.error("UserProducts fetch error:", e);
        setUserProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [user_id, router, pollPendingNotifications]
  );

  useFocusEffect(
    useCallback(() => {
      // When returning from ExpiryBuckets (or any child screen),
      // refresh the grouped list if we're currently inside a food type.
      if (selectedFoodType) {
        handleFoodTypePress(selectedFoodType);
      }
    }, [selectedFoodType, handleFoodTypePress])
  );

  const handleBackPress = async () => {
    if (selectedFoodType) {
      setSelectedFoodType(null);
      setUserProducts([]);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setFoodTypes([]);
    }

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

  const handleManualAddPress = () => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "/ProductPicker",
      params: { user_id: String(user_id) },
    });
  };

  const handleManageTypesPress = () => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "/ManageCategoriesFoodTypes",
      params: { user_id: String(user_id) },
    });
  };

  // -------------------------------
  // Expiry buckets navigation (tap a grouped card)
  // -------------------------------
  const openBuckets = (prod: UserProduct) => {
    if (!user_id) return;

    router.push({
      pathname: "../ExpiryBuckets",
      params: {
        user_id: String(user_id),
        productId: String(prod.product_id),
        productName: prod.product_name,
        storeId: prod.store_id === null ? "" : String(prod.store_id),
        storeName: prod.store_name ?? "No store",
        foodTypeId: selectedFoodType ? String(selectedFoodType.id) : "",
      },
    });
  };

  const loadExpiringSoon = useCallback(async () => {
    if (!user_id) return;

    try {
      const res = await fetch(`${API_BASE_URL}/user/${user_id}/expiringSoon`);
      if (!res.ok) return;

      const data = await res.json();
      setExpiringSoon(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Expiring soon fetch error:", e);
      setExpiringSoon([]);
    }
  }, [user_id]);

  useFocusEffect(
    useCallback(() => {
      loadExpiringSoon();
    }, [loadExpiringSoon])
  );

  // -------------------------------
  // Render helpers
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
        <TouchableOpacity
          key={`${prod.product_id}-${String(prod.store_id)}-${idx}`}
          style={styles.productCard}
          onPress={() => openBuckets(prod)}
          activeOpacity={0.8}
        >
          <Text style={styles.productName}>{prod.product_name}</Text>
          <Text style={styles.productDetails}>
            Store: {prod.store_name ?? "None"}
          </Text>
          <Text style={styles.productDetails}>Qty: {prod.quantity}</Text>
          <Text style={styles.productDetails}>
            Nearest expiry: {prod.nearest_expiry ?? "None"}
          </Text>

          {prod.last_price !== null && prod.last_price !== undefined && (
            <Text style={styles.productDetails}>
              Last price: €{Number(prod.last_price).toFixed(2)}
            </Text>
          )}

          <Text style={styles.tapHint}>Tap to manage expiry batches →</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // -------------------------------
  // Main render
  // -------------------------------
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
        >
          <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageButton}
          onPress={handleManageTypesPress}
        >
          <Text style={styles.manageButtonText}>Manage Types</Text>
        </TouchableOpacity>
      </View>

      {!selectedCategory && !selectedFoodType && (
        <TouchableOpacity
          style={styles.soonCard}
          activeOpacity={0.85}
          disabled={!user_id}
          onPress={() =>
            router.push({
              pathname: "/ExpiringSoon",
              params: { user_id: String(user_id) },
            })
          }
        >
          <View style={styles.soonHeaderRow}>
            <Text style={styles.soonTitle}>Expiring soon</Text>
            <Text style={styles.soonCount}>{expiringSoon.length}</Text>
          </View>

          <Text style={styles.soonHint}>
            Tap to view items expiring within your notification windows
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
        <Text style={styles.scanButtonText}>📷 Scan Item</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.scanButton} onPress={handleManualAddPress}>
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
              categories.map((cat) => ({
                key: String(cat.id),
                label: cat.name,
              })),
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

  topRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  settingsButton: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  settingsButtonText: {
    color: "#663399",
    fontWeight: "800",
    fontSize: 14,
  },

  manageButton: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  manageButtonText: {
    color: "#663399",
    fontWeight: "800",
    fontSize: 14,
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
  productDetails: { fontSize: 14, color: "#555", textAlign: "center" },

  tapHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#663399",
    textAlign: "center",
  },

  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  backButtonText: { color: "#663399", fontSize: 16, fontWeight: "bold" },

  soonCard: {
  width: "100%",
  maxWidth: 360,
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 14,
  marginTop: 10,
  marginBottom: 10,
  },
  soonHeaderRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  },
  soonTitle: { fontWeight: "900", color: "#333", fontSize: 16 },
  soonCount: {
    fontWeight: "900",
    color: "#333",
    fontSize: 18,
    backgroundColor: "#ffcc00",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  soonHint: { marginTop: 8, color: "#666", fontSize: 12 },
});