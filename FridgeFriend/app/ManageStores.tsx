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

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { colors, fontWeight, spacing } from "../styles/tokens";

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
                  }
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
                        `• price history: ${c.user_product_prices}`
                    );
                    return;
                  }

                  Alert.alert(
                    "Error",
                    data?.message ?? "Could not delete store."
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
        ]
      );
    },
    [userId, loadStores]
  );

  const renderItem = ({ item }: { item: Store }) => {
    const isSystem = Boolean(item.is_system);

    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {isSystem ? "System store" : "Your store"}
          </Text>
        </View>

        {!isSystem && (
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.danger]}
            onPress={() => confirmDelete(item)}
            disabled={loading}
          >
            <Text style={buttonStyles.dangerText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!userId) {
    return (
      <View style={commonStyles.screenPrimary}>
        <Text style={styles.title}>Manage Stores</Text>
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.missingText}>
            Missing user id — please log in again.
          </Text>
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.accent, styles.primaryBtn]}
            onPress={() => router.replace("/LoginScreen")}
          >
            <Text style={buttonStyles.accentText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={commonStyles.screenPrimary}>
      <Text style={styles.title}>Manage Stores</Text>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>Create a new store</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Dunnes"
          style={[formStyles.inputAlt, styles.input]}
          editable={!creating}
        />
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.accent, styles.primaryBtn, creating && styles.dimmed]}
          onPress={createStore}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator />
          ) : (
            <Text style={buttonStyles.accentText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[commonStyles.card, styles.card, styles.listCard]}>
        <Text style={styles.label}>All stores</Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => String(s.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.light, styles.backBtn]}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.primaryTextOn,
    fontSize: 22,
    fontWeight: fontWeight.black,
    marginBottom: spacing.lg,
  },
  card: {},
  listCard: {
    marginTop: spacing.lg,
    flex: 1,
  },
  label: {
    fontWeight: fontWeight.black,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: 0,
  },
  primaryBtn: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  rowMain: {
    flex: 1,
  },
  name: {
    fontWeight: fontWeight.black,
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  backBtn: {
    marginTop: spacing.lg,
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.primary,
    fontWeight: fontWeight.black,
  },
  missingText: {
    color: colors.text,
    fontWeight: fontWeight.heavy,
  },
  dimmed: {
    opacity: 0.7,
  },
});