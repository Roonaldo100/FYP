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
  TextInput,
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
  last_price?: number | null;   // 🔥 ADD THIS
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

  // Remove flow state
  const [removeTarget, setRemoveTarget] = useState<UserProduct | null>(null);
  const [removeQtyText, setRemoveQtyText] = useState<string>("1");
  const [removing, setRemoving] = useState<boolean>(false);

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

    // Use absolute path for reliability with expo-router
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
      pathname: "/ManualAddProduct",
      params: { user_id: String(user_id) },
    });
  };

  // -------------------------------
  // Remove flow
  // -------------------------------
  const openRemove = (prod: UserProduct) => {
    setRemoveTarget(prod);
    setRemoveQtyText("1");
  };

  const closeRemove = () => {
    setRemoveTarget(null);
    setRemoveQtyText("1");
    setRemoving(false);
  };

  const confirmRemove = async () => {
    if (!removeTarget || !user_id) return;

    const maxQty = Number(removeTarget.quantity);
    const parsed = Number(removeQtyText);

    if (!parsed || parsed <= 0) {
      Alert.alert("Invalid quantity", "Enter a number greater than 0.");
      return;
    }
    if (parsed > maxQty) {
      Alert.alert("Invalid quantity", `You can remove up to ${maxQty}.`);
      return;
    }

    Alert.alert(
      "Confirm removal",
      `Remove ${parsed} of ${removeTarget.product_name} from ${
        removeTarget.store_name ?? "No store"
      }?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemoving(true);

              const resp = await fetch(`${API_BASE_URL}/user_products/remove`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user_id,
                  productId: removeTarget.product_id,
                  storeId: removeTarget.store_id,
                  quantity: parsed,
                }),
              });

              if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                console.error("Remove failed:", resp.status, txt);
                Alert.alert("Error", "Failed to remove items.");
                setRemoving(false);
                return;
              }

              if (selectedFoodType) {
                await handleFoodTypePress(selectedFoodType);
              }

              closeRemove();
            } catch (e) {
              console.error("Remove error:", e);
              Alert.alert("Error", "Failed to remove items.");
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

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
        <View
          key={`${prod.product_id}-${String(prod.store_id)}-${idx}`}
          style={styles.productCard}
        >
          <TouchableOpacity style={styles.removeX} onPress={() => openRemove(prod)}>
            <Text style={styles.removeXText}>×</Text>
          </TouchableOpacity>

          <Text style={styles.productName}>{prod.product_name}</Text>
          <Text style={styles.productDetails}>Store: {prod.store_name ?? "None"}</Text>
          <Text style={styles.productDetails}>Qty: {prod.quantity}</Text>
          <Text style={styles.productDetails}>
            Expires: {prod.nearest_expiry ?? "None"}
          </Text>
          {prod.last_price !== null && prod.last_price !== undefined && (
          <Text style={styles.productDetails}>
            Last price: €{Number(prod.last_price).toFixed(2)}
          </Text>
        )}
        </View>
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
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
          <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>

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

      {removeTarget && (
        <View style={styles.removeOverlay}>
          <View style={styles.removePanel}>
            <Text style={styles.removeTitle}>Remove items</Text>
            <Text style={styles.removeSub}>
              {removeTarget.product_name} ({removeTarget.store_name ?? "No store"})
            </Text>
            <Text style={styles.removeSub}>Max: {removeTarget.quantity}</Text>

            <TextInput
              style={styles.removeInput}
              value={removeQtyText}
              onChangeText={setRemoveQtyText}
              keyboardType="number-pad"
              placeholder="Quantity"
            />

            <TouchableOpacity
              style={styles.removeConfirmButton}
              onPress={confirmRemove}
              disabled={removing}
            >
              <Text style={styles.removeConfirmText}>
                {removing ? "Removing..." : "Continue"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeCancelButton}
              onPress={closeRemove}
              disabled={removing}
            >
              <Text style={styles.removeCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    alignItems: "flex-end",
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
    position: "relative",
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

  removeX: {
    position: "absolute",
    top: 6,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 40,
    backgroundColor: "#eee",
  },
  removeXText: {
    fontSize: 18,
    color: "#333",
    fontWeight: "700",
    lineHeight: 18,
  },

  removeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0008",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  removePanel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  removeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  removeSub: {
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
  },
  removeInput: {
    backgroundColor: "#eee",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  removeConfirmButton: {
    backgroundColor: "#663399",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  removeConfirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  removeCancelButton: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  removeCancelText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 16,
  },
});
