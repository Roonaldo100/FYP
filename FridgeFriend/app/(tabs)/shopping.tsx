import React, { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect, useGlobalSearchParams, useRouter } from "expo-router";

import { API_BASE_URL } from "../../config/apiConfig";
import { useAppStyles } from "../../lib/useAppStyles";
import { fontSize, fontWeight, spacing } from "../../styles/tokens";

function toValidUserId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type ListRow = {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
};

const MAX_SHOPPING_LIST_NAME_LENGTH = 40;

export default function ShoppingTab() {
  const params = useGlobalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidUserId(params.user_id), [params.user_id]);
  const router = useRouter();

  const { colors, commonStyles, formStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [newName, setNewName] = useState("");

  const loadLists = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ListRow[] = await res.json();
      setLists(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load shopping lists.");
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists])
  );

  const createList = async () => {
    if (!userId) return;

    const name = newName.trim();

    if (!name) {
      Alert.alert("Missing name", "Enter a list name.");
      return;
    }

    if (name.length > MAX_SHOPPING_LIST_NAME_LENGTH) {
      Alert.alert(
        "Name too long",
        `Shopping list names can be at most ${MAX_SHOPPING_LIST_NAME_LENGTH} characters.`
      );
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const text = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!res.ok) {
        Alert.alert("Error", data?.message || "Could not create list.");
        return;
      }

      setNewName("");
      await loadLists();

      const listId = Number(data?.list_id);
      if (Number.isFinite(listId) && listId > 0) {
        router.push({
          pathname: "../ShoppingListDetail",
          params: { user_id: String(userId), listId: String(listId) },
        });
      }
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not create list.");
    } finally {
      setLoading(false);
    }
  };

  const openList = (l: ListRow) => {
    if (!userId) return;

    router.push({
      pathname: "../ShoppingListDetail",
      params: { user_id: String(userId), listId: String(l.id) },
    });
  };

  const deleteList = (l: ListRow) => {
    if (!userId) return;

    Alert.alert("Delete list?", `Delete "${l.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);

            const res = await fetch(
              `${API_BASE_URL}/user/${userId}/shoppingLists/${l.id}`,
              {
                method: "DELETE",
              }
            );

            if (!res.ok) {
              const t = await res.text().catch(() => "");
              throw new Error(t || `HTTP ${res.status}`);
            }

            await loadLists();
          } catch (e) {
            console.warn(e);
            Alert.alert("Error", "Could not delete list.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopping Lists</Text>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.cardTitle}>Create list</Text>

        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Weekly shop"
          placeholderTextColor={colors.textMuted}
          style={[formStyles.inputAlt, styles.input]}
        />

        <TouchableOpacity
          style={[buttonStyles.base, styles.primaryDarkButton]}
          onPress={createList}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryTextOn} />
          ) : (
            <Text style={styles.primaryDarkButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[commonStyles.card, styles.row]}>
              <TouchableOpacity style={styles.rowMain} onPress={() => openList(item)}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.updated_at ? `Updated: ${String(item.updated_at)}` : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.danger]}
                onPress={() => deleteList(item)}
              >
                <Text style={buttonStyles.dangerText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No saved lists yet.</Text>}
        />
      )}
    </View>
  );
}

function makeStyles(colors: {
  surfaceMuted: string;
  text: string;
  borderSoft: string;
  primaryTextOn: string;
  textMuted: string;
  surfaceAlt: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.xl,
      paddingTop: 18,
    },
    title: {
      fontSize: 22,
      fontWeight: fontWeight.heavy,
      color: colors.text,
    },
    card: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    cardTitle: {
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.sm,
      color: colors.text,
    },
    input: {
      marginBottom: 0,
    },
    primaryDarkButton: {
      marginTop: spacing.md,
      backgroundColor: colors.text,
    },
    primaryDarkButtonText: {
      color: colors.primaryTextOn,
      fontWeight: fontWeight.heavy,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    row: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    rowMain: {
      flex: 1,
    },
    rowTitle: {
      fontWeight: fontWeight.heavy,
      fontSize: fontSize.md,
      color: colors.text,
    },
    rowMeta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    empty: {
      marginTop: spacing.xxxl,
      color: colors.textMuted,
      textAlign: "center",
    },
  });
}