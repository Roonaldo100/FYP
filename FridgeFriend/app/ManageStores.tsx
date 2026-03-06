import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

type Store = {
  id: number;
  name: string;
  is_system?: boolean;
  owner_user_id?: number | null;
};

function toValidId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

export default function ManageStores() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string }>();

  const userId = useMemo(() => toValidId(params.user_id), [params.user_id]);

  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadStores = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/stores?userId=${userId}`);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("ManageStores loadStores error:", e);
      setStores([]);
      Alert.alert("Error", "Could not load stores.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const createStore = useCallback(async () => {
    if (!userId) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert("Missing name", "Enter a store name.");
      return;
    }

    try {
      setCreating(true);
      const resp = await fetch(`${API_BASE_URL}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, userId }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("Create store failed:", resp.status, txt);
        Alert.alert("Error", "Could not create store.");
        return;
      }

      setNewName("");
      await loadStores();
    } catch (e) {
      console.error("Create store error:", e);
      Alert.alert("Error", "Could not create store.");
    } finally {
      setCreating(false);
    }
  }, [userId, newName, loadStores, router]);

  const confirmDelete = useCallback(
    (store: Store) => {
      if (!userId) return;

      Alert.alert(
        "Delete store?",
        `Delete "${store.name}"?\n\nThis will set things using this store to no store.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                setLoading(true);
                const resp = await fetch(
                  `${API_BASE_URL}/user/${userId}/stores/${store.id}/safe`,
                  {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deletePriceHistory: false }),
                  },
                );

                if (!resp.ok) {
                  const data = await resp.json().catch(() => null);
                  console.error("Delete store failed:", resp.status, data);

                  if (resp.status === 409 && data?.counts) {
                    const c = data.counts;
                    Alert.alert(
                      "Store in use",
                      `Can't delete because it's referenced:\n` +
                        `• inventory rows: ${c.user_products}\n` +
                        `• product links: ${c.product_store}\n` +
                        `• shopping items: ${c.shopping_list_items}\n` +
                        `• price history: ${c.user_product_prices}`,
                    );
                    return;
                  }

                  Alert.alert(
                    "Error",
                    data?.message ?? "Could not delete store.",
                  );
                  return;
                }

                await loadStores();
              } catch (e) {
                console.error("Delete store error:", e);
                Alert.alert("Error", "Could not delete store.");
              } finally {
                setLoading(false);
              }
            },
          },
        ],
      );
    },
    [userId, loadStores],
  );

  const renderItem = ({ item }: { item: Store }) => {
    const isSystem = Boolean(item.is_system);

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {isSystem ? "System store" : "Your store"}
          </Text>
        </View>

        {!isSystem && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => confirmDelete(item)}
            disabled={loading}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Manage Stores</Text>
        <View style={styles.card}>
          <Text style={{ color: "#333", fontWeight: "800" }}>
            Missing user id — please log in again.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/LoginScreen")}
          >
            <Text style={styles.primaryText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Stores</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Create a new store</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Dunnes"
          style={styles.input}
          editable={!creating}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, creating && { opacity: 0.7 }]}
          onPress={createStore}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { marginTop: 12, flex: 1 }]}>
        <Text style={styles.label}>All stores</Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => String(s.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#663399",
    padding: 16,
    paddingTop: 40,
  },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginBottom: 12 },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  label: { fontWeight: "900", color: "#333", marginBottom: 8 },

  input: {
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#ffcc00",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { fontWeight: "900", color: "#333" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  name: { fontWeight: "900", color: "#333" },
  meta: { marginTop: 4, color: "#666", fontWeight: "700" },

  deleteBtn: {
    backgroundColor: "#b00020",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginLeft: 10,
  },
  deleteText: { color: "#fff", fontWeight: "900" },

  backBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  backText: { color: "#663399", fontWeight: "900" },
});
