import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { useGlobalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../config/apiConfig";
import { commonStyles } from "../../styles/common";
import { formStyles } from "../../styles/forms";
import { buttonStyles } from "../../styles/buttons";
import { colors, fontSize, fontWeight, radius, spacing } from "../../styles/tokens";

type ChatRole = "user" | "assistant";

//type RecipeIngredient = string | { name: string; productId?: number | null };

type NutritionSummary = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type Recipe = {
  title: string;
  url?: string | null;
  source?: "spoonacular" | "custom";
  external_id?: string | null;
  ingredients?: string[];
  used: string[];
  missing: string[];
  servings?: number | null;
  nutritionSummary?: NutritionSummary | null;
  nutrition?: any | null;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  recipes?: Recipe[];
};

function toValidUserId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ChatTab() {
  const params = useGlobalSearchParams<{ user_id?: string }>();
  const userId = useMemo(() => toValidUserId(params.user_id), [params.user_id]);

  //initial message given to the user
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed-1", //for persistence
      role: "assistant",
      text:
        'Ask for a dish like "apple pie". I’ll fetch its ingredients and compare them to your inventory.',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null); //useRef allows for later auto-scroll to bottom mechanics n

  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const openUrl = async (url: string) => {
    const u =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    const can = await Linking.canOpenURL(u);
    if (can) {
      await Linking.openURL(u);
    } else {
      console.warn("Cannot open url:", u);
    }
  };

  const saveRecipe = async (r: Recipe, key: string) => {
    if (!userId) {
      Alert.alert("Missing user id", "Please re-open Tabs with user_id.");
      return;
    }

    setSavingKey(key);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/recipes/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: {
            title: r.title,
            url: r.url ?? null,
            source: r.source ?? "spoonacular",
            external_id: r.external_id ?? null,
            ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
            servings: r.servings ?? null,
            nutrition: r.nutrition ?? null,
          },
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      appendMessage({
        id: String(Date.now() + 999),
        role: "assistant",
        text: `Saved "${r.title}" to your Recipes tab ✅`,
      });
    } catch (e) {
      console.warn("Save recipe error:", e);
      Alert.alert("Save failed", "Could not save recipe. Check server logs.");
    } finally {
      setSavingKey(null);
    }
  };

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    appendMessage({ id: String(Date.now()), role: "user", text: trimmed });

    if (!userId) {
      appendMessage({
        id: String(Date.now() + 1),
        role: "assistant",
        text:
          "I can’t see your user id on this tab. Make sure you navigated into Tabs with user_id (e.g. /(tabs)?user_id=...).",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: trimmed }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data: { reply: string; recipes?: Recipe[] } = await res.json();

      appendMessage({
        id: String(Date.now() + 2),
        role: "assistant",
        text: data.reply || "Done.",
        recipes: data.recipes || [],
      });
    } catch (e) {
      appendMessage({
        id: String(Date.now() + 3),
        role: "assistant",
        text:
          "Sorry — I couldn’t fetch recipe suggestions right now. Check your server is running and reachable from the phone.",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    return (
      <View style={styles.messageWrap}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text style={styles.bubbleText}>{item.text}</Text>
        </View>

        {!!item.recipes?.length && (
          <View style={styles.recipeList}>
            {item.recipes.map((r, idx) => {
              const key = `${item.id}-recipe-${idx}`;
              const saving = savingKey === key;

              return (
                <View key={key} style={[commonStyles.card, styles.recipeCard]}>
                  <Text style={styles.recipeTitle}>{r.title}</Text>

                  <Text style={styles.recipeMeta}>
                    You have: {r.used.length ? r.used.join(", ") : "—"}
                  </Text>

                  <Text style={styles.recipeMeta}>
                    You need: {r.missing.length ? r.missing.join(", ") : "—"}
                  </Text>

                  {!!r.nutritionSummary && (
                    <Text style={styles.recipeMeta}>
                      Nutrition (per serving):{" "}
                      {r.nutritionSummary.calories != null
                        ? `${r.nutritionSummary.calories} kcal`
                        : "—"}{" "}
                      |{" "}
                      {r.nutritionSummary.protein_g != null
                        ? `${r.nutritionSummary.protein_g} g protein`
                        : "—"}{" "}
                      |{" "}
                      {r.nutritionSummary.carbs_g != null
                        ? `${r.nutritionSummary.carbs_g} g carbs`
                        : "—"}{" "}
                      |{" "}
                      {r.nutritionSummary.fat_g != null
                        ? `${r.nutritionSummary.fat_g} g fat`
                        : "—"}
                    </Text>
                  )}

                  {!!r.url && (
                    <Text style={styles.linkText} onPress={() => openUrl(r.url!)}>
                      {r.url}
                    </Text>
                  )}

                  <View style={styles.recipeActions}>
                    <TouchableOpacity
                      onPress={() => saveRecipe(r, key)}
                      disabled={saving}
                      style={[
                        buttonStyles.base,
                        styles.actionButton,
                        saving ? styles.disabledDarkButton : styles.darkButton,
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.primaryTextOn} />
                      ) : (
                        <Text style={styles.darkButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder='Try: "I want to make an apple pie"'
          style={[formStyles.inputAlt, styles.input]}
          editable={!loading}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />

        <TouchableOpacity
          onPress={onSend}
          disabled={loading}
          style={[
            buttonStyles.base,
            styles.sendButton,
            loading ? styles.disabledDarkButton : styles.darkButton,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryTextOn} />
          ) : (
            <Text style={styles.darkButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: 90,
  },
  messageWrap: {
    paddingVertical: spacing.sm,
  },
  bubble: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#DCF8C6",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
  },
  bubbleText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  recipeList: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  recipeCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  recipeTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  recipeMeta: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  linkText: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: "#1a73e8",
    textDecorationLine: "underline",
  },
  recipeActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    paddingHorizontal: spacing.lg,
  },
  inputBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  input: {
    flex: 1,
    marginBottom: 0,
    fontSize: fontSize.md,
  },
  sendButton: {
    paddingHorizontal: spacing.xl,
  },
  darkButton: {
    backgroundColor: "#111",
  },
  disabledDarkButton: {
    backgroundColor: "#ccc",
  },
  darkButtonText: {
    color: colors.primaryTextOn,
    fontWeight: fontWeight.medium,
  },
});