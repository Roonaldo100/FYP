import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect, useGlobalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../config/apiConfig";

function toValidUserId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type SavedRecipe = {
  id: number;
  title: string;
  source: string;
  external_id?: string | null;
  url?: string | null;
  saved_at?: string;
};

type MissingResponse = {
  recipe: { id: number; title: string; url?: string | null };
  have: string[];
  missing: string[];
};

type ProductHit = { id: number; name: string };

type RecipeDetails = {
  id: number;
  title: string;
  source: string;
  external_id?: string | null;
  url?: string | null;
  ingredients: { id: number; name: string; amount: number | null; unit: string | null }[];
};

export default function RecipesTab() {
  const params = useGlobalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidUserId(params.user_id), [params.user_id]);

  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);

  // Missing display
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingData, setMissingData] = useState<MissingResponse | null>(null);

  // Create recipe form
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);

  // Add ingredient input + optional product search
  const [ingredientInput, setIngredientInput] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  // Edit recipe form
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editRecipeId, setEditRecipeId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editIngredients, setEditIngredients] = useState<string[]>([]);
  const [editIngredientInput, setEditIngredientInput] = useState("");

  const openUrl = async (url: string) => {
    const u =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    const can = await Linking.canOpenURL(u);
    if (can) await Linking.openURL(u);
    else Alert.alert("Cannot open link", u);
  };

  const fetchSaved = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/recipes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SavedRecipe[] = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load saved recipes.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [fetchSaved])
  );

  const showMissing = async (recipeId: number) => {
    if (!userId) return;

    setMissingLoading(true);
    setMissingData(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/recipes/${recipeId}/missing`
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data: MissingResponse = await res.json();
      setMissingData(data);
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not compute missing items for this recipe.");
    } finally {
      setMissingLoading(false);
    }
  };

  const removeIngredientAt = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const addIngredientName = (raw: string) => {
    const name = raw.trim();
    if (!name) return;

    // enforce minimum 3 characters
    if (name.length < 3) {
      Alert.alert("Ingredient too short", "Ingredients must be at least 3 characters long.");
      return;
    }

    setIngredients((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === name.toLowerCase());
      return exists ? prev : [...prev, name];
    });

    setIngredientInput("");
    setProductHits([]);
  };

  const searchProducts = async (q: string) => {
    setIngredientInput(q);

    const query = q.trim();
    if (!query || query.length < 2) {
      setProductHits([]);
      return;
    }

    setProductSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/products/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProductHit[] = await res.json();
      setProductHits(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      setProductHits([]);
    } finally {
      setProductSearchLoading(false);
    }
  };

  const createRecipe = async () => {
    if (!userId) return;

    const title = newTitle.trim();
    if (!title) {
      Alert.alert("Missing title", "Please enter a recipe title.");
      return;
    }
    if (!ingredients.length) {
      Alert.alert("Missing ingredients", "Add at least one ingredient.");
      return;
    }

    const bad = ingredients.find((x) => x.trim().length < 3);
    if (bad) {
      Alert.alert(
        "Ingredient too short",
        `This ingredient is too short: "${bad}". Ingredients must be at least 3 characters.`
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url: newUrl.trim() || null,
          ingredients,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      Alert.alert("Created", "Recipe saved to your list ✅");
      setNewTitle("");
      setNewUrl("");
      setIngredients([]);
      setIngredientInput("");
      setProductHits([]);
      setCreateOpen(false);
      fetchSaved();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not create recipe. Check server logs.");
    }
  };

  // --------------------------
  // EDIT / DELETE
  // --------------------------
  const openEdit = async (recipe: SavedRecipe) => {
    if (!userId) return;

    // UI rule: only custom recipes are editable
    if (recipe.source !== "custom") {
      Alert.alert("Not editable", "Only recipes you created can be edited.");
      return;
    }

    setEditLoading(true);
    setEditOpen(true);
    setEditRecipeId(recipe.id);

    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/recipes/${recipe.id}`);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const details: RecipeDetails = await res.json();

      setEditTitle(String(details.title || ""));
      setEditUrl(String(details.url || ""));
      setEditIngredients(
        Array.isArray(details.ingredients)
          ? details.ingredients.map((i) => String(i.name || "")).filter(Boolean)
          : []
      );
      setEditIngredientInput("");
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load recipe for editing.");
      setEditOpen(false);
      setEditRecipeId(null);
    } finally {
      setEditLoading(false);
    }
  };

  const addEditIngredientName = () => {
    const name = editIngredientInput.trim();
    if (!name) return;

    if (name.length < 3) {
      Alert.alert("Ingredient too short", "Ingredients must be at least 3 characters long.");
      return;
    }

    setEditIngredients((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === name.toLowerCase());
      return exists ? prev : [...prev, name];
    });
    setEditIngredientInput("");
  };

  const removeEditIngredientAt = (idx: number) => {
    setEditIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEdit = async () => {
    if (!userId || !editRecipeId) return;

    const title = editTitle.trim();
    if (!title) {
      Alert.alert("Missing title", "Please enter a recipe title.");
      return;
    }
    if (!editIngredients.length) {
      Alert.alert("Missing ingredients", "Add at least one ingredient.");
      return;
    }

    const bad = editIngredients.find((x) => x.trim().length < 3);
    if (bad) {
      Alert.alert(
        "Ingredient too short",
        `This ingredient is too short: "${bad}". Ingredients must be at least 3 characters.`
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/recipes/${editRecipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url: editUrl.trim() || null,
          ingredients: editIngredients,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      Alert.alert("Saved", "Recipe updated ✅");
      setEditOpen(false);
      setEditRecipeId(null);
      fetchSaved();
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not update recipe.");
    }
  };

  const removeOrDelete = (recipe: SavedRecipe) => {
    if (!userId) return;

    const isCustom = recipe.source === "custom";
    const verb = isCustom ? "Delete" : "Remove";
    const msg = isCustom
      ? "This will remove it from your saved list. If you created it and no one else saved it, it may be deleted permanently."
      : "This will remove it from your saved recipes.";

    Alert.alert(`${verb} recipe`, msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: verb,
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(
              `${API_BASE_URL}/user/${userId}/recipes/${recipe.id}`,
              { method: "DELETE" }
            );
            if (!res.ok) {
              const t = await res.text().catch(() => "");
              throw new Error(t || `HTTP ${res.status}`);
            }

            if (missingData?.recipe?.id === recipe.id) setMissingData(null);

            if (editRecipeId === recipe.id) {
              setEditOpen(false);
              setEditRecipeId(null);
            }

            fetchSaved();
          } catch (e) {
            console.warn(e);
            Alert.alert("Error", `Could not ${verb.toLowerCase()} recipe.`);
          }
        },
      },
    ]);
  };

  const canAddIngredient = ingredientInput.trim().length >= 3;
  const canAddEditIngredient = editIngredientInput.trim().length >= 3;

  return (
    <View style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <View style={{ padding: 14, paddingBottom: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Recipes</Text>

        <TouchableOpacity
          onPress={() => setCreateOpen((v) => !v)}
          style={{
            marginTop: 10,
            backgroundColor: "#111",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {createOpen ? "Close create" : "Create recipe"}
          </Text>
        </TouchableOpacity>

        {createOpen && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16 }}>New recipe</Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Recipe title"
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 10,
                padding: 10,
              }}
            />

            <TextInput
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="Optional source URL"
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 10,
                padding: 10,
              }}
            />

            <Text style={{ marginTop: 12, fontWeight: "700" }}>Add ingredient</Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TextInput
                value={ingredientInput}
                onChangeText={searchProducts}
                placeholder="Type ingredient (min 3 chars)"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 10,
                  padding: 10,
                }}
              />
              <TouchableOpacity
                onPress={() => addIngredientName(ingredientInput)}
                disabled={!canAddIngredient}
                style={{
                  backgroundColor: canAddIngredient ? "#111" : "#999",
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  justifyContent: "center",
                  opacity: canAddIngredient ? 1 : 0.7,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
              </TouchableOpacity>
            </View>

            {productSearchLoading ? (
              <View style={{ marginTop: 8 }}>
                <ActivityIndicator />
              </View>
            ) : null}

            {!!productHits.length && (
              <View
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {productHits.slice(0, 8).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => addIngredientName(p.name)}
                    style={{
                      padding: 10,
                      borderTopWidth: 1,
                      borderTopColor: "#f0f0f0",
                    }}
                  >
                    <Text>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={{ marginTop: 12, fontWeight: "700" }}>Ingredients</Text>

            {!ingredients.length ? (
              <Text style={{ marginTop: 6, color: "#666" }}>None yet.</Text>
            ) : (
              <View style={{ marginTop: 6, gap: 6 }}>
                {ingredients.map((name, idx) => (
                  <View
                    key={`${name}-${idx}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#fafafa",
                      borderWidth: 1,
                      borderColor: "#eee",
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text>{name}</Text>
                    <TouchableOpacity onPress={() => removeIngredientAt(idx)}>
                      <Text style={{ color: "#b00020", fontWeight: "700" }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={createRecipe}
              style={{
                marginTop: 14,
                backgroundColor: "#111",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Save recipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {editOpen && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16 }}>Edit recipe</Text>

            {editLoading ? (
              <View style={{ marginTop: 10 }}>
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Recipe title"
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    padding: 10,
                  }}
                />

                <TextInput
                  value={editUrl}
                  onChangeText={setEditUrl}
                  placeholder="Optional source URL"
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    padding: 10,
                  }}
                />

                <Text style={{ marginTop: 12, fontWeight: "700" }}>Add ingredient</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <TextInput
                    value={editIngredientInput}
                    onChangeText={setEditIngredientInput}
                    placeholder="Type ingredient (min 3 chars)"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: "#ddd",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  />
                  <TouchableOpacity
                    onPress={addEditIngredientName}
                    disabled={!canAddEditIngredient}
                    style={{
                      backgroundColor: canAddEditIngredient ? "#111" : "#999",
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      justifyContent: "center",
                      opacity: canAddEditIngredient ? 1 : 0.7,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ marginTop: 12, fontWeight: "700" }}>Ingredients</Text>

                {!editIngredients.length ? (
                  <Text style={{ marginTop: 6, color: "#666" }}>None yet.</Text>
                ) : (
                  <View style={{ marginTop: 6, gap: 6 }}>
                    {editIngredients.map((name, idx) => (
                      <View
                        key={`${name}-${idx}`}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "#fafafa",
                          borderWidth: 1,
                          borderColor: "#eee",
                          padding: 10,
                          borderRadius: 10,
                        }}
                      >
                        <Text>{name}</Text>
                        <TouchableOpacity onPress={() => removeEditIngredientAt(idx)}>
                          <Text style={{ color: "#b00020", fontWeight: "700" }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={saveEdit}
                    style={{
                      flex: 1,
                      backgroundColor: "#111",
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setEditOpen(false);
                      setEditRecipeId(null);
                    }}
                    style={{
                      backgroundColor: "#eee",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 14 }}>
        {loading ? (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#eee",
                  marginTop: 10,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700" }}>
                  {item.title}
                </Text>

                {!!item.url && (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#1a73e8",
                      textDecorationLine: "underline",
                    }}
                    onPress={() => openUrl(item.url!)}
                  >
                    {item.url}
                  </Text>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => showMissing(item.id)}
                    style={{
                      backgroundColor: "#111",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      What am I missing?
                    </Text>
                  </TouchableOpacity>

                  {item.source === "custom" && (
                    <TouchableOpacity
                      onPress={() => openEdit(item)}
                      style={{
                        backgroundColor: "#eee",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => removeOrDelete(item)}
                    style={{
                      backgroundColor: "#b00020",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {item.source === "custom" ? "Delete" : "Remove"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {missingLoading && missingData?.recipe?.id === item.id ? (
                  <View style={{ marginTop: 10 }}>
                    <ActivityIndicator />
                  </View>
                ) : null}

                {missingData?.recipe?.id === item.id && !missingLoading ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontWeight: "700" }}>✅ Have</Text>
                    <Text style={{ marginTop: 4 }}>
                      {missingData.have.length ? missingData.have.join(", ") : "—"}
                    </Text>

                    <Text style={{ marginTop: 10, fontWeight: "700" }}>🛒 Missing</Text>
                    <Text style={{ marginTop: 4 }}>
                      {missingData.missing.length ? missingData.missing.join(", ") : "—"}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
