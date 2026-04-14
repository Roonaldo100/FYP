import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

import { useAppStyles } from "../lib/useAppStyles";
import { fontWeight, spacing, type AppColors } from "../styles/tokens";

type ProductRow = {
  id: number;
  name: string;
  food_type: number | null;
  is_system: boolean;
  owner_user_id: number | null;
};

export default function ProductPicker() {
  const router = useRouter();
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();

  const { colors, commonStyles, formStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE = 30;

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const queryRef = useRef("");

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!user_id) return;

      if (!reset) {
        if (!hasMoreRef.current) return;
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const currentQuery = queryRef.current.trim();
        const offset = reset ? 0 : offsetRef.current;

        const qs =
          `userId=${encodeURIComponent(String(user_id))}` +
          `&q=${encodeURIComponent(currentQuery)}` +
          `&limit=${PAGE}` +
          `&offset=${offset}`;

        const r = await fetch(`${API_BASE_URL}/products/search?${qs}`);
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.error("products/search failed:", r.status, txt);
          hasMoreRef.current = false;
          return;
        }

        const data: ProductRow[] = await r.json();
        const arr = Array.isArray(data) ? data : [];

        if (reset) {
          setItems(arr);
          offsetRef.current = PAGE;
        } else {
          setItems((prev) => [...prev, ...arr]);
          offsetRef.current = offset + PAGE;
        }

        hasMoreRef.current = arr.length === PAGE;
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [user_id]
  );

  useEffect(() => {
    queryRef.current = q;

    const t = setTimeout(() => {
      hasMoreRef.current = true;
      offsetRef.current = 0;
      fetchPage(true);
    }, 250);

    return () => clearTimeout(t);
  }, [q, fetchPage]);

  const onPick = (p: ProductRow) => {
    router.push({
      pathname: "/AddItemToFridge",
      params: {
        user_id: String(user_id),
        product_id: String(p.id),
        product_name: p.name,
      },
    });
  };

  const onEndReached = () => {
    if (!loading) fetchPage(false);
  };

  const goManualAdd = () => {
    if (!user_id) return;
    router.push({
      pathname: "/ManualAddProduct",
      params: { user_id: String(user_id) },
    });
  };

  return (
    <View style={commonStyles.screenPrimary}>
      <Text style={styles.title}>Add an item</Text>

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.accent, styles.manualBtn]}
        onPress={goManualAdd}
      >
        <Text style={styles.manualBtnText}>➕ Add a brand new product (Manual)</Text>
      </TouchableOpacity>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search products…"
        placeholderTextColor={colors.textLight}
        style={[formStyles.input, styles.search]}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryTextOn} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primaryTextOn} /> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[commonStyles.card, styles.row]}
              onPress={() => onPick(item)}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.owner_user_id ? "Your product" : "System product"}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.light, styles.backBtn]}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    title: {
      color: colors.primaryTextOn,
      fontSize: 22,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.lg,
    },
    manualBtn: {
      marginBottom: spacing.lg,
    },
    manualBtnText: {
      color: colors.text,
      fontWeight: fontWeight.black,
    },
    search: {
      marginBottom: spacing.lg,
    },
    row: {
      marginBottom: spacing.md,
    },
    name: {
      fontWeight: fontWeight.heavy,
      color: colors.text,
    },
    meta: {
      marginTop: spacing.xs,
      color: colors.textMuted,
    },
    backBtn: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    backText: {
      color: colors.primary,
      fontWeight: fontWeight.heavy,
    },
  });
}