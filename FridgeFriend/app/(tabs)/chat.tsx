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
} from "react-native";
import { useGlobalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../config/apiConfig";

type ChatRole = "user" | "assistant";

type RecipeIngredient = string | { name: string; productId?: number | null };

type Recipe = {
  title: string;
  url?: string | null;

  // NEW: needed for saving + de-duping spoonacular recipes
  source?: "spoonacular" | "custom";
  external_id?: string | null;

  // NEW: needed to persist ingredients when saving from chat
  ingredients?: string[];

  used: string[];
  missing: string[];
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

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed-1",
      role: "assistant",
      text:
        'Ask for a dish like "apple pie". I’ll fetch its ingredients and compare them to your inventory.',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // track "saving" per card so button can show Saving...
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);

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
            // store ingredient strings so the saved recipe can show missing later
            ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
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
      <View style={{ paddingVertical: 8 }}>
        <View
          style={{
            alignSelf: isUser ? "flex-end" : "flex-start",
            backgroundColor: isUser ? "#DCF8C6" : "#EEE",
            padding: 12,
            borderRadius: 12,
            maxWidth: "85%",
          }}
        >
          <Text style={{ fontSize: 16 }}>{item.text}</Text>
        </View>

        {!!item.recipes?.length && (
          <View style={{ marginTop: 10, gap: 10 }}>
            {item.recipes.map((r, idx) => {
              const key = `${item.id}-recipe-${idx}`;
              const saving = savingKey === key;

              return (
                <View
                  key={key}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#eee",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {r.title}
                  </Text>

                  <Text style={{ marginTop: 6, fontSize: 13 }}>
                    You have: {r.used.length ? r.used.join(", ") : "—"}
                  </Text>

                  <Text style={{ marginTop: 2, fontSize: 13 }}>
                    You need: {r.missing.length ? r.missing.join(", ") : "—"}
                  </Text>

                  {!!r.url && (
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "#1a73e8",
                        textDecorationLine: "underline",
                      }}
                      onPress={() => openUrl(r.url!)}
                    >
                      {r.url}
                    </Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => saveRecipe(r, key)}
                      disabled={saving}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: saving ? "#ccc" : "#111",
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                          Save
                        </Text>
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
      style={{ flex: 1, backgroundColor: "#fafafa" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: "#eee",
          backgroundColor: "#fff",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder='Try: "I want to make an apple pie"'
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
          }}
          editable={!loading}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={loading}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: loading ? "#ccc" : "#111",
          }}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
