import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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

import { commonStyles } from "../../styles/common";
import { buttonStyles } from "../../styles/buttons";
import { colors, fontSize, fontWeight, radius, spacing } from "../../styles/tokens";

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

  const pollPendingNotifications = useCallback(async () => {
    if (!user_id) return;

    const ok = await registerForLocalNotificationsAsync();
    if (!ok) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/user/${user_id}/pendingNotifications`);
      if (!resp.ok) return;

      const rows: {
        user_product_id: number;
        product_name: string;
        days_left: number;
        effective_period_days: number;
      }[] = await resp.json();

      for (const row of rows) {
        await sendExpiryNotification(row.product_name, Number(row.days_left));

        await fetch(`${API_BASE_URL}/user_products/${row.user_product_id}/markNotified`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("Pending notification poll error:", e);
    }
  }, [user_id]);

  useFocusEffect(
    useCallback(() => {
      pollPendingNotifications();
    }, [pollPendingNotifications])
  );

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

  const handleCategoryPress = async (category: Category) => {
    setLoading(true);
    setSelectedCategory(category);
    setSelectedFoodType(null);
    setUserProducts([]);

    try {
      const res = await fetch(`${API_BASE_URL}/categories/${category.id}/food?userId=${user_id}`);
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
        const res = await fetch(`${API_BASE_URL}/user/${user_id}/foodtype/${foodType.id}`);
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
      pathname: "../BarcodeScanner",
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
      pathname: "../ProductPicker",
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
      pathname: "../ManageCategoriesFoodTypes",
      params: { user_id: String(user_id) },
    });
  };

  const handleFrequentlyUsedPress = () => {
    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    router.push({
      pathname: "../FrequentlyUsed",
      params: { user_id: String(user_id) },
    });
  };

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
          style={[buttonStyles.gridButton, buttonStyles.accent]}
          onPress={() => onPress(item.key)}
        >
          <Text style={styles.gridButtonText}>{item.label}</Text>
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
          <Text style={styles.productDetails}>Store: {prod.store_name ?? "None"}</Text>
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

  return (
    <View style={commonStyles.screenPrimary}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="light" />

        <View style={styles.topRow}>
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
            onPress={handleSettingsPress}
          >
            <Text style={styles.topButtonText}>⚙️ Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.topButton]}
            onPress={handleManageTypesPress}
          >
            <Text style={styles.topButtonText}>Manage Types</Text>
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

        <Text style={[commonStyles.titleOnPrimary, styles.title]}>{title}</Text>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.actionButton]}
          onPress={handleScanPress}
        >
          <Text style={styles.actionButtonText}>📷 Scan Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.actionButton]}
          onPress={handleManualAddPress}
        >
          <Text style={styles.actionButtonText}>➕ Add Item Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.light, styles.actionButton]}
          onPress={handleFrequentlyUsedPress}
        >
          <Text style={styles.actionButtonText}>⭐ Frequently Used</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color={colors.primaryTextOn} />}

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
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light, styles.backButton]}
            onPress={handleBackPress}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingBottom: 40,
  },
  topRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  topButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  topButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.heavy,
    fontSize: fontSize.sm,
  },
  title: {
    marginBottom: spacing.xxxl,
    textAlign: "center",
  },
  actionButton: {
    marginBottom: 15,
    paddingHorizontal: spacing.xxxl,
  },
  actionButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: 320,
  },
  gridButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  productCard: {
    backgroundColor: colors.surface,
    width: 150,
    borderRadius: radius.md,
    padding: spacing.md,
    margin: 5,
    alignItems: "center",
  },
  productName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: "center",
  },
  productDetails: {
    fontSize: fontSize.sm,
    color: "#555",
    textAlign: "center",
  },
  tapHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: "center",
  },
  backButton: {
    marginTop: spacing.xxxl,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  soonCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  soonHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  soonTitle: {
    fontWeight: fontWeight.black,
    color: colors.text,
    fontSize: fontSize.md,
  },
  soonCount: {
    fontWeight: fontWeight.black,
    color: colors.text,
    fontSize: 18,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  soonHint: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});