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
  StyleSheet,
} from "react-native";
import { useFocusEffect, useGlobalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../config/apiConfig";
import { useAppStyles } from "../../lib/useAppStyles";
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  type AppColors,
} from "../../styles/tokens";

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
  ingredients: { name: string }[];
};

type NutritionResponse = {
  recipe_id: number;
  servings: number | null;
  nutrition: any | null;
  nutrition_updated_at: string | null;
  cached: boolean;
};

export default function RecipesTab() {
  const params = useGlobalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidUserId(params.user_id), [params.user_id]);

  const { colors, commonStyles, formStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);

  const [missingLoading, setMissingLoading] = useState(false);
  const [missingData, setMissingData] = useState<MissingResponse | null>(null);

  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionData, setNutritionData] = useState<NutritionResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);

  const [ingredientInput, setIngredientInput] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

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

  const showNutrition = async (recipeId: number) => {
    if (!userId) return;

    setNutritionLoading(true);
    setNutritionData(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/recipes/${recipeId}/nutrition`
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data: NutritionResponse = await res.json();
      setNutritionData(data);
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load nutrition for this recipe.");
    } finally {
      setNutritionLoading(false);
    }
  };

  const removeIngredientAt = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const addIngredientName = (raw: string) => {
    const name = raw.trim();
    if (!name) return;

    if (name.length < 3) {
      Alert.alert(
        "Ingredient too short",
        "Ingredients must be at least 3 characters long."
      );
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

    if (!userId) {
      setProductHits([]);
      return;
    }

    setProductSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/products/search?q=${encodeURIComponent(
          query
        )}&userId=${encodeURIComponent(String(userId))}`
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

  const openEdit = async (recipe: SavedRecipe) => {
    if (!userId) return;

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
          ? details.ingredients.map((i: any) => String(i?.name ?? "")).filter(Boolean)
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
      Alert.alert(
        "Ingredient too short",
        "Ingredients must be at least 3 characters long."
      );
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
            if (nutritionData?.recipe_id === recipe.id) setNutritionData(null);

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

  const formatNutrientLine = (n: any) => {
    const name = String(n?.name ?? "").trim();
    const amount = n?.amount;
    const unit = String(n?.unit ?? "").trim();
    if (!name) return null;

    const amt =
      typeof amount === "number" && Number.isFinite(amount)
        ? amount
        : amount != null
        ? String(amount)
        : "";

    return `${name}: ${amt}${unit ? ` ${unit}` : ""}`.trim();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Recipes</Text>

        <TouchableOpacity
          onPress={() => setCreateOpen((v) => !v)}
          style={[
            buttonStyles.base,
            buttonStyles.primary,
            styles.inlineAction,
            styles.outlinedPrimaryButton,
          ]}
        >
          <Text style={buttonStyles.primaryText}>
            {createOpen ? "Close create" : "Create recipe"}
          </Text>
        </TouchableOpacity>

        {createOpen && (
          <View style={[commonStyles.card, styles.panelCard]}>
            <Text style={styles.sectionHeading}>New recipe</Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Recipe title"
              placeholderTextColor={colors.textLight}
              style={[formStyles.inputAlt, styles.inputSpacing]}
            />

            <TextInput
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="Optional source URL"
              placeholderTextColor={colors.textLight}
              style={[formStyles.inputAlt, styles.inputSpacing]}
            />

            <Text style={styles.subHeading}>Add ingredient</Text>

            <View style={styles.inputRow}>
              <TextInput
                value={ingredientInput}
                onChangeText={searchProducts}
                placeholder="Type ingredient (min 3 chars)"
                placeholderTextColor={colors.textLight}
                style={[formStyles.inputAlt, styles.flexInput]}
              />
              <TouchableOpacity
                onPress={() => addIngredientName(ingredientInput)}
                disabled={!canAddIngredient}
                style={[
                  buttonStyles.base,
                  styles.smallActionButton,
                  canAddIngredient ? buttonStyles.primary : styles.disabledButton,
                ]}
              >
                <Text
                  style={canAddIngredient ? buttonStyles.primaryText : styles.disabledButtonText}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>

            {productSearchLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={colors.primaryTextOn} />
              </View>
            ) : null}

            {!!productHits.length && (
              <View style={styles.searchHits}>
                {productHits.slice(0, 8).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => addIngredientName(p.name)}
                    style={styles.searchHitRow}
                  >
                    <Text style={styles.searchHitText}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.subHeading}>Ingredients</Text>

            {!ingredients.length ? (
              <Text style={styles.emptyInline}>None yet.</Text>
            ) : (
              <View style={styles.ingredientList}>
                {ingredients.map((name, idx) => (
                  <View key={`${name}-${idx}`} style={styles.ingredientRow}>
                    <Text style={styles.ingredientName}>{name}</Text>
                    <TouchableOpacity onPress={() => removeIngredientAt(idx)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={createRecipe}
              style={[buttonStyles.base, buttonStyles.primary, styles.saveButton]}
            >
              <Text style={buttonStyles.primaryText}>Save recipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {editOpen && (
          <View style={[commonStyles.card, styles.panelCard]}>
            <Text style={styles.sectionHeading}>Edit recipe</Text>

            {editLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={colors.primaryTextOn} />
              </View>
            ) : (
              <>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Recipe title"
                  placeholderTextColor={colors.textLight}
                  style={[formStyles.inputAlt, styles.inputSpacing]}
                />

                <TextInput
                  value={editUrl}
                  onChangeText={setEditUrl}
                  placeholder="Optional source URL"
                  placeholderTextColor={colors.textLight}
                  style={[formStyles.inputAlt, styles.inputSpacing]}
                />

                <Text style={styles.subHeading}>Add ingredient</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={editIngredientInput}
                    onChangeText={setEditIngredientInput}
                    placeholder="Type ingredient (min 3 chars)"
                    placeholderTextColor={colors.textLight}
                    style={[formStyles.inputAlt, styles.flexInput]}
                  />
                  <TouchableOpacity
                    onPress={addEditIngredientName}
                    disabled={!canAddEditIngredient}
                    style={[
                      buttonStyles.base,
                      styles.smallActionButton,
                      canAddEditIngredient ? buttonStyles.primary : styles.disabledButton,
                    ]}
                  >
                    <Text
                      style={
                        canAddEditIngredient ? buttonStyles.primaryText : styles.disabledButtonText
                      }
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subHeading}>Ingredients</Text>

                {!editIngredients.length ? (
                  <Text style={styles.emptyInline}>None yet.</Text>
                ) : (
                  <View style={styles.ingredientList}>
                    {editIngredients.map((name, idx) => (
                      <View key={`${name}-${idx}`} style={styles.ingredientRow}>
                        <Text style={styles.ingredientName}>{name}</Text>
                        <TouchableOpacity onPress={() => removeEditIngredientAt(idx)}>
                          <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={saveEdit}
                    style={[buttonStyles.base, buttonStyles.primary, styles.editSaveButton]}
                  >
                    <Text style={buttonStyles.primaryText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setEditOpen(false);
                      setEditRecipeId(null);
                    }}
                    style={[buttonStyles.base, buttonStyles.secondary]}
                  >
                    <Text style={buttonStyles.secondaryText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.listArea}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.primaryTextOn} />
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isMissingThis = missingData?.recipe?.id === item.id;
              const isNutritionThis = nutritionData?.recipe_id === item.id;

              const nutrients: any[] = Array.isArray(nutritionData?.nutrition?.nutrients)
                ? nutritionData!.nutrition!.nutrients
                : [];

              return (
                <View style={[commonStyles.card, styles.recipeCard]}>
                  <Text style={styles.recipeTitle}>{item.title}</Text>

                  {!!item.url && (
                    <Text style={styles.linkText} onPress={() => openUrl(item.url!)}>
                      {item.url}
                    </Text>
                  )}

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => showMissing(item.id)}
                      style={[buttonStyles.base, buttonStyles.primary]}
                    >
                      <Text style={buttonStyles.primaryText}>What am I missing?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => showNutrition(item.id)}
                      style={[buttonStyles.base, buttonStyles.primary]}
                    >
                      <Text style={buttonStyles.primaryText}>Show nutrition</Text>
                    </TouchableOpacity>

                    {item.source === "custom" && (
                      <TouchableOpacity
                        onPress={() => openEdit(item)}
                        style={[buttonStyles.base, buttonStyles.secondary]}
                      >
                        <Text style={buttonStyles.secondaryText}>Edit</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => removeOrDelete(item)}
                      style={[buttonStyles.base, buttonStyles.danger]}
                    >
                      <Text style={buttonStyles.dangerText}>
                        {item.source === "custom" ? "Delete" : "Remove"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {missingLoading && isMissingThis ? (
                    <View style={styles.loaderWrapSmall}>
                      <ActivityIndicator color={colors.primaryTextOn} />
                    </View>
                  ) : null}

                  {isMissingThis && !missingLoading ? (
                    <View style={styles.infoPanel}>
                      <Text style={styles.infoTitle}>✅ Have</Text>
                      <Text style={styles.infoText}>
                        {missingData!.have.length ? missingData!.have.join(", ") : "—"}
                      </Text>

                      <Text style={[styles.infoTitle, styles.infoTitleSpacing]}>
                        🛒 Missing
                      </Text>
                      <Text style={styles.infoText}>
                        {missingData!.missing.length ? missingData!.missing.join(", ") : "—"}
                      </Text>
                    </View>
                  ) : null}

                  {nutritionLoading && isNutritionThis ? (
                    <View style={styles.loaderWrapSmall}>
                      <ActivityIndicator color={colors.primaryTextOn} />
                    </View>
                  ) : null}

                  {isNutritionThis && !nutritionLoading ? (
                    <View style={styles.infoPanel}>
                      <Text style={styles.infoTitle}>Nutrition</Text>
                      <Text style={styles.subtleText}>
                        Servings: {nutritionData?.servings ?? "—"}
                      </Text>

                      {!nutritionData?.nutrition ? (
                        <Text style={styles.emptyInline}>
                          No nutrition available for this recipe.
                        </Text>
                      ) : (
                        <>
                          <Text style={[styles.infoTitle, styles.infoTitleSpacing]}>
                            Nutrients (per serving)
                          </Text>

                          {nutrients.length ? (
                            <View style={styles.nutrientList}>
                              {nutrients.slice(0, 10).map((n, idx) => {
                                const line = formatNutrientLine(n);
                                if (!line) return null;
                                return (
                                  <Text key={idx} style={styles.nutrientText}>
                                    {line}
                                  </Text>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.emptyInline}>—</Text>
                          )}

                          {!!nutritionData?.nutrition_updated_at && (
                            <Text style={styles.updatedText}>
                              Updated: {nutritionData.nutrition_updated_at}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
    },
    headerArea: {
      padding: spacing.xl,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: 22,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    inlineAction: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
    },
    panelCard: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    sectionHeading: {
      fontWeight: fontWeight.bold,
      fontSize: fontSize.md,
      color: colors.text,
    },
    subHeading: {
      marginTop: spacing.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    inputSpacing: {
      marginTop: spacing.md,
      marginBottom: 0,
    },
    inputRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    flexInput: {
      flex: 1,
      marginBottom: 0,
    },
    smallActionButton: {
      paddingHorizontal: spacing.lg,
      justifyContent: "center",
    },
    searchHits: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    searchHitRow: {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    searchHitText: {
      color: colors.text,
    },
    ingredientList: {
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    ingredientRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    ingredientName: {
      color: colors.text,
    },
    removeText: {
      color: colors.danger,
      fontWeight: fontWeight.bold,
    },
    saveButton: {
      marginTop: spacing.xl,
    },
    editActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    editSaveButton: {
      flex: 1,
    },
    listArea: {
      flex: 1,
      paddingHorizontal: spacing.xl,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    recipeCard: {
      borderWidth: 1,
      borderColor: colors.borderSoft,
      marginTop: spacing.md,
    },
    recipeTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    linkText: {
      marginTop: spacing.sm,
      fontSize: fontSize.xs,
      color: colors.accent,
      textDecorationLine: "underline",
    },
    cardActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
      flexWrap: "wrap",
    },
    infoPanel: {
      marginTop: spacing.md,
    },
    infoTitle: {
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    infoTitleSpacing: {
      marginTop: spacing.md,
    },
    infoText: {
      marginTop: spacing.xs,
      color: colors.text,
    },
    subtleText: {
      marginTop: spacing.xs,
      color: colors.textMuted,
    },
    nutrientList: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    nutrientText: {
      color: colors.text,
    },
    updatedText: {
      marginTop: spacing.sm,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    emptyInline: {
      marginTop: spacing.sm,
      color: colors.textMuted,
    },
    loaderWrap: {
      marginTop: spacing.sm,
    },
    loaderWrapSmall: {
      marginTop: spacing.md,
    },
    disabledButton: {
      backgroundColor: colors.surfaceAlt,
      opacity: 0.7,
    },
    disabledButtonText: {
      color: colors.textMuted,
      fontWeight: fontWeight.bold,
    },
    outlinedPrimaryButton: {
      borderWidth: 1,
      borderColor: colors.primaryTextOn,
    },
  });
}