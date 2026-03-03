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

export default function ShoppingTab() {
  const params = useGlobalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidUserId(params.user_id), [params.user_id]);
  const router = useRouter();

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
      } catch {}

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
            const res = await fetch(`${API_BASE_URL}/user/${userId}/shoppingLists/${l.id}`, {
              method: "DELETE",
            });
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create list</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Weekly shop"
          style={styles.input}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={createList} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.primaryBtnText}>Create</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openList(item)}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.updated_at ? `Updated: ${String(item.updated_at)}` : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dangerBtn} onPress={() => deleteList(item)}>
                <Text style={styles.dangerText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No saved lists yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa", padding: 14, paddingTop: 18 },
  title: { fontSize: 22, fontWeight: "800" },

  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: { fontWeight: "800", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  row: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontWeight: "800", fontSize: 16 },
  rowMeta: { marginTop: 4, color: "#666", fontSize: 12 },

  dangerBtn: {
    backgroundColor: "#b00020",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dangerText: { color: "#fff", fontWeight: "800" },

  empty: { marginTop: 20, color: "#666", textAlign: "center" },
});