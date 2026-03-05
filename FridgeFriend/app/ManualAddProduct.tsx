import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ManualAddProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;

    // shopping list prefill
    prefill_name?: string;
    prefill_store_id?: string; // "" => null
    prefill_store_name?: string;
    prefill_quantity?: string;

    from_shopping_list?: string; // "1"
    listId?: string;
    itemId?: string;
  }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const fromShopping = params.from_shopping_list === "1";
  const listId = useMemo(() => toValidId(params.listId), [params.listId]);
  const itemId = useMemo(() => toValidId(params.itemId), [params.itemId]);

  const prefillQty = useMemo(() => {
    const n = Number(params.prefill_quantity ?? 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [params.prefill_quantity]);

  const prefillStoreId = useMemo(() => {
    const s = String(params.prefill_store_id ?? "");
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [params.prefill_store_id]);

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType | null>(null);

  const [loading, setLoading] = useState(false);

  // apply prefill once
  useEffect(() => {
    if (params.prefill_name && !name) setName(String(params.prefill_name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = useCallback(async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/categories?userId=${userId}`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Categories fetch error:", e);
      setCategories([]);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const title = useMemo(() => {
    if (selectedFoodType) return "Confirm Product";
    if (selectedCategory) return "Choose Food Type";
    return fromShopping ? "Create Product (from shopping list)" : "Add Product Manually";
  }, [selectedCategory, selectedFoodType, fromShopping]);

  const handleCategoryPress = async (cat: Category) => {
    if (!userId) return;
    setLoading(true);
    setSelectedCategory(cat);
    setSelectedFoodType(null);
    setFoodTypes([]);

    try {
      const res = await fetch(`${API_BASE_URL}/categories/${cat.id}/food?userId=${userId}`);
      const data = await res.json();
      setFoodTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Food types fetch error:", e);
      setFoodTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const addToInventoryQty = async (productId: number) => {
    if (!userId) return;

    // add N rows (your server addProduct endpoint adds 1 item at a time)
    for (let i = 0; i < prefillQty; i++) {
      const resp = await fetch(`${API_BASE_URL}/user/addProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          productId,
          storeId: prefillStoreId, // can be null, server will map to No store
          expiryDate: null,
          price: null,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `HTTP ${resp.status}`);
      }
    }
  };

  const markShoppingItemAsResolved = async (productId: number) => {
    if (!fromShopping || !userId || !listId || !itemId) return;

    // Update the shopping list item to reference the newly-created product.
    // This endpoint must exist in server.js (see server additions below).
    const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${listId}/items/${itemId}/attachProduct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        storeId: prefillStoreId, // optional; lets server set store_id if you want
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `HTTP ${res.status}`);
    }
  };

  const handleConfirm = async () => {
    if (!userId || !name || !selectedFoodType) {
      Alert.alert("Missing information", "Please complete all required fields.");
      return;
    }

    setLoading(true);

    const trimmedBarcode = barcode.trim() ? barcode.trim() : null;

    try {
      const createResp = await fetch(`${API_BASE_URL}/products/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          name,
          barcode: trimmedBarcode,
          foodTypeId: selectedFoodType.id,
          storeId: prefillStoreId, // allow prefill store attach
          allowExisting: false,
        }),
      });

      if (!createResp.ok) {
        const txt = await createResp.text().catch(() => "");
        console.error("Create product failed:", createResp.status, txt);
        Alert.alert("Error", "Failed to create product.");
        return;
      }

      const created = await createResp.json();

      if (created.barcode_conflict) {
        Alert.alert(
          "Barcode recognised",
          `This barcode is recognised as "${created.existing_product_name}" in the database.\n\nWould you like to use the recognised product?`,
          [
            { text: "Go back", style: "cancel" },
            {
              text: "Use recognised product",
              onPress: async () => {
                try {
                  setLoading(true);

                  const confirmResp = await fetch(`${API_BASE_URL}/products/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: Number(userId),
                      name,
                      barcode: trimmedBarcode,
                      foodTypeId: selectedFoodType.id,
                      storeId: prefillStoreId,
                      allowExisting: true,
                    }),
                  });

                  if (!confirmResp.ok) {
                    const txt = await confirmResp.text().catch(() => "");
                    console.error("Confirm existing failed:", confirmResp.status, txt);
                    Alert.alert("Error", "Failed to use recognised product.");
                    return;
                  }

                  const confirmed = await confirmResp.json();
                  const pid = Number(confirmed.product_id);

                  if (fromShopping) {
                    await markShoppingItemAsResolved(pid);
                    await addToInventoryQty(pid);

                    // return to custom list screen
                    router.back();
                    return;
                  }

                  router.push({
                    pathname: "/AddItemToFridge",
                    params: {
                      user_id: String(userId),
                      product_id: String(pid),
                      product_name: String(confirmed.product_name ?? name),
                    },
                  });
                } catch (e) {
                  console.error("Confirm existing error:", e);
                  Alert.alert("Error", "Unable to proceed.");
                } finally {
                  setLoading(false);
                }
              },
            },
          ]
        );
        return;
      }

      const pid = Number(created.product_id);

      if (fromShopping) {
        await markShoppingItemAsResolved(pid);
        await addToInventoryQty(pid);

        // go back to ShoppingListCustomItems (which will refresh on focus)
        router.back();
        return;
      }

      router.push({
        pathname: "/AddItemToFridge",
        params: {
          user_id: String(userId),
          product_id: String(pid),
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

          {fromShopping && (
            <Text style={[styles.helperText, { marginTop: 10 }]}>
              From shopping list: Qty {prefillQty} • Store {params.prefill_store_name ?? "No store"}
            </Text>
          )}
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