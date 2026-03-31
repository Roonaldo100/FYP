// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   ActivityIndicator,
//   FlatList,
//   Modal,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { useFocusEffect } from "@react-navigation/native";
// import { API_BASE_URL } from "../config/apiConfig";

// import { commonStyles } from "../styles/common";
// import { formStyles } from "../styles/forms";
// import { buttonStyles } from "../styles/buttons";
// import { modalStyles } from "../styles/modals";
// import { colors, fontSize, fontWeight, radius, spacing } from "../styles/tokens";

// function toValidId(v: unknown): number | null {
//   const n = Number(v);
//   return Number.isFinite(n) && n > 0 ? n : null;
// }

// type CategoryRow = {
//   id: number;
//   name: string;
// };

// type FoodTypeRow = {
//   id: number;
//   name: string;
//   category: number;
// };

// type ProductRow = {
//   id: number;
//   name: string;
//   food_type: number | null;
//   is_system?: boolean;
//   owner_user_id?: number | null;
// };

// type FoodTypeIndexRow = {
//   id: number;
//   name: string;
//   categoryId: number;
//   categoryName: string;
// };

// const PAGE = 30;

// function mergeByIdNewWins(prev: ProductRow[], next: ProductRow[]) {
//   const m = new Map<number, ProductRow>();

//   for (const p of prev) {
//     const id = Number(p?.id);
//     if (!Number.isFinite(id)) continue;
//     m.set(id, p);
//   }

//   for (const p of next) {
//     const id = Number(p?.id);
//     if (!Number.isFinite(id)) continue;
//     m.set(id, p);
//   }

//   return Array.from(m.values());
// }

// function sortProductsAlphabetically(rows: ProductRow[]) {
//   return [...rows].sort((a, b) =>
//     String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
//       sensitivity: "base",
//     })
//   );

// }

// export default function EditProducts() {
//   const router = useRouter();
//   const params = useLocalSearchParams<{ user_id?: string; refresh?: string }>();

//   const userIdNum = useMemo(() => toValidId(params.user_id), [params.user_id]);
//   const refreshToken = params.refresh ?? "";

//   const [q, setQ] = useState("");
//   const [items, setItems] = useState<ProductRow[]>([]);
//   const [foodTypeNameById, setFoodTypeNameById] = useState<Map<number, string>>(new Map());
//   const [foodTypeIndexRows, setFoodTypeIndexRows] = useState<FoodTypeIndexRow[]>([]);

//   const [loading, setLoading] = useState(false);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [errorText, setErrorText] = useState<string>("");

//   const [foodTypeFilterId, setFoodTypeFilterId] = useState<number | null>(null);
//   const [foodTypeFilterModalOpen, setFoodTypeFilterModalOpen] = useState(false);

//   const hasMoreRef = useRef(true);
//   const offsetRef = useRef(0);
//   const queryRef = useRef("");
//   const loadingMoreRef = useRef(false);

//   const loadFoodTypesIndex = useCallback(async () => {
//     if (!userIdNum) return;

//     try {
//       const catRes = await fetch(
//         `${API_BASE_URL}/categories?userId=${encodeURIComponent(String(userIdNum))}`
//       );

//       if (!catRes.ok) {
//         const txt = await catRes.text().catch(() => "");
//         throw new Error(txt || `HTTP ${catRes.status}`);
//       }

//       const catData = await catRes.json();
//       const categories: CategoryRow[] = Array.isArray(catData) ? catData : [];

//       const nameMap = new Map<number, string>();
//       const rows: FoodTypeIndexRow[] = [];

//       await Promise.all(
//         categories.map(async (cat) => {
//           const ftRes = await fetch(
//             `${API_BASE_URL}/categories/${encodeURIComponent(String(cat.id))}/food?userId=${encodeURIComponent(
//               String(userIdNum)
//             )}`
//           );

//           if (!ftRes.ok) {
//             const txt = await ftRes.text().catch(() => "");
//             throw new Error(txt || `HTTP ${ftRes.status}`);
//           }

//           const ftData = await ftRes.json();
//           const arr: FoodTypeRow[] = Array.isArray(ftData) ? ftData : [];

//           for (const ft of arr) {
//             const id = Number(ft.id);
//             if (!Number.isFinite(id)) continue;

//             nameMap.set(id, String(ft.name));
//             rows.push({
//               id,
//               name: String(ft.name),
//               categoryId: Number(cat.id),
//               categoryName: String(cat.name),
//             });
//           }
//         })
//       );

//       rows.sort((a, b) => {
//         const categoryCmp = a.categoryName.localeCompare(b.categoryName, undefined, {
//           sensitivity: "base",
//         });
//         if (categoryCmp !== 0) return categoryCmp;

//         return a.name.localeCompare(b.name, undefined, {
//           sensitivity: "base",
//         });
//       });

//       setFoodTypeNameById(nameMap);
//       setFoodTypeIndexRows(rows);
//     } catch (e) {
//       console.error("foodTypes fetch error:", e);
//       setFoodTypeNameById(new Map());
//       setFoodTypeIndexRows([]);
//     }
//   }, [userIdNum]);

//   const fetchPage = useCallback(
//     async (reset: boolean) => {
//       if (!userIdNum) return;

//       if (!reset) {
//         if (!hasMoreRef.current) return;
//         if (loadingMoreRef.current) return;
//         loadingMoreRef.current = true;
//         setLoadingMore(true);
//       } else {
//         setLoading(true);
//         setErrorText("");
//       }

//       try {
//         const currentQuery = queryRef.current.trim();
//         const offset = reset ? 0 : offsetRef.current;

//         const qs =
//           `userId=${encodeURIComponent(String(userIdNum))}` +
//           `&q=${encodeURIComponent(currentQuery)}` +
//           `&limit=${PAGE}` +
//           `&offset=${offset}`;

//         const r = await fetch(`${API_BASE_URL}/products/search?${qs}`);
//         if (!r.ok) {
//           const txt = await r.text().catch(() => "");
//           throw new Error(txt || `HTTP ${r.status}`);
//         }

//         const data = await r.json();
//         const arrRaw: ProductRow[] = Array.isArray(data) ? data : [];

//         const arr = arrRaw.filter((p) => {
//           const isSystem = p.is_system === true;
//           const owner = p.owner_user_id == null ? null : Number(p.owner_user_id);
//           return !isSystem && owner === userIdNum;
//         });

//         if (reset) {
//           setItems(arr);
//           offsetRef.current = arrRaw.length;
//         } else {
//           setItems((prev) => mergeByIdNewWins(prev, arr));
//           offsetRef.current = offset + arrRaw.length;
//         }

//         hasMoreRef.current = arrRaw.length === PAGE;
//       } catch (e: any) {
//         console.error("products/search error:", e);
//         setErrorText(e?.message || "Network error");
//         hasMoreRef.current = false;
//       } finally {
//         if (reset) {
//           setLoading(false);
//         } else {
//           loadingMoreRef.current = false;
//           setLoadingMore(false);
//         }
//       }
//     },
//     [userIdNum]
//   );

//   useEffect(() => {
//     if (!userIdNum) return;
//     queryRef.current = "";
//     hasMoreRef.current = true;
//     offsetRef.current = 0;
//     loadFoodTypesIndex();
//     fetchPage(true);
//   }, [userIdNum, loadFoodTypesIndex, fetchPage]);

//   useEffect(() => {
//     if (!userIdNum) return;
//     queryRef.current = q;

//     const t = setTimeout(() => {
//       hasMoreRef.current = true;
//       offsetRef.current = 0;
//       fetchPage(true);
//     }, 250);

//     return () => clearTimeout(t);
//   }, [q, userIdNum, fetchPage]);

//   useEffect(() => {
//     if (!userIdNum) return;
//     if (!refreshToken) return;

//     hasMoreRef.current = true;
//     offsetRef.current = 0;

//     loadFoodTypesIndex();
//     fetchPage(true);
//   }, [refreshToken, userIdNum, loadFoodTypesIndex, fetchPage]);

//   useFocusEffect(
//     useCallback(() => {
//       if (!userIdNum) return;

//       queryRef.current = q;
//       hasMoreRef.current = true;
//       offsetRef.current = 0;

//       loadFoodTypesIndex();
//       fetchPage(true);
//     }, [userIdNum, q, loadFoodTypesIndex, fetchPage])
//   );

//   const onEdit = (p: ProductRow) => {
//     if (!userIdNum) return;
//     router.push({
//       pathname: "/EditProduct",
//       params: { user_id: String(userIdNum), product_id: String(p.id) },
//     });
//   };

//   const filteredItems = useMemo(() => {
//     let rows = items;

//     if (foodTypeFilterId !== null) {
//       rows = rows.filter((p) => Number(p.food_type) === Number(foodTypeFilterId));
//     }

//     return sortProductsAlphabetically(rows);
//   }, [items, foodTypeFilterId]);

//   const selectedFoodTypeLabel = useMemo(() => {
//     if (foodTypeFilterId === null) return "All food types";
//     const row = foodTypeIndexRows.find((ft) => Number(ft.id) === Number(foodTypeFilterId));
//     return row ? `${row.categoryName} • ${row.name}` : "Filtered food type";
//   }, [foodTypeFilterId, foodTypeIndexRows]);

//   const renderItem = ({ item }: { item: ProductRow }) => {
//     const ftName =
//       item.food_type != null ? foodTypeNameById.get(Number(item.food_type)) : null;

//     return (
//       <TouchableOpacity
//         style={[commonStyles.card, styles.row]}
//         onPress={() => onEdit(item)}
//       >
//         <View style={styles.rowMain}>
//           <Text style={styles.name}>{item.name}</Text>
//           <Text style={styles.meta}>Food type: {ftName ?? "None"}</Text>
//         </View>
//         <Text style={styles.chev}>›</Text>
//       </TouchableOpacity>
//     );
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Edit Products</Text>

//       <TextInput
//         style={[formStyles.inputAlt, styles.search]}
//         placeholder="Search your products…"
//         value={q}
//         onChangeText={setQ}
//         autoCapitalize="none"
//       />

//       <View style={styles.filterRow}>
//         <TouchableOpacity
//           style={[buttonStyles.base, buttonStyles.light, styles.filterBtn]}
//           onPress={() => setFoodTypeFilterModalOpen(true)}
//         >
//           <Text style={styles.filterBtnText}>{selectedFoodTypeLabel}</Text>
//         </TouchableOpacity>

//         {foodTypeFilterId !== null && (
//           <TouchableOpacity
//             style={[buttonStyles.base, buttonStyles.secondary]}
//             onPress={() => setFoodTypeFilterId(null)}
//           >
//             <Text style={buttonStyles.secondaryText}>Clear filter</Text>
//           </TouchableOpacity>
//         )}
//       </View>

//       {loading && <ActivityIndicator />}

//       {!loading && !!errorText && <Text style={styles.errorText}>{errorText}</Text>}

//       {!loading && !errorText && filteredItems.length === 0 && (
//         <Text style={styles.emptyText}>
//           {items.length === 0 ? "No products found." : "No products match this food type."}
//         </Text>
//       )}

//       <FlatList
//         data={filteredItems}
//         keyExtractor={(it) => `p_${String(it.id)}`}
//         renderItem={renderItem}
//         onEndReachedThreshold={0.5}
//         onEndReached={() => {
//           if (!loading && !loadingMore) fetchPage(false);
//         }}
//         ListFooterComponent={
//           loadingMore ? (
//             <View style={styles.footerLoader}>
//               <ActivityIndicator />
//             </View>
//           ) : null
//         }
//       />

//       <TouchableOpacity
//         style={[buttonStyles.base, styles.darkButton, styles.backBtn]}
//         onPress={() => router.back()}
//       >
//         <Text style={styles.darkButtonText}>← Back</Text>
//       </TouchableOpacity>

//       <Modal
//         visible={foodTypeFilterModalOpen}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setFoodTypeFilterModalOpen(false)}
//       >
//         <View style={modalStyles.backdrop}>
//           <View style={modalStyles.card}>
//             <Text style={modalStyles.title}>Filter by food type</Text>

//             <TouchableOpacity
//               style={modalStyles.row}
//               onPress={() => {
//                 setFoodTypeFilterId(null);
//                 setFoodTypeFilterModalOpen(false);
//               }}
//             >
//               <Text style={modalStyles.rowText}>All food types</Text>
//             </TouchableOpacity>

//             <FlatList
//               data={foodTypeIndexRows}
//               keyExtractor={(item) => String(item.id)}
//               style={styles.modalList}
//               renderItem={({ item }) => (
//                 <TouchableOpacity
//                   style={modalStyles.row}
//                   onPress={() => {
//                     setFoodTypeFilterId(item.id);
//                     setFoodTypeFilterModalOpen(false);
//                   }}
//                 >
//                   <Text style={modalStyles.rowText}>
//                     {item.categoryName} • {item.name}
//                   </Text>
//                 </TouchableOpacity>
//               )}
//             />

//             <TouchableOpacity
//               style={[buttonStyles.base, styles.darkButton, styles.modalCloseBtn]}
//               onPress={() => setFoodTypeFilterModalOpen(false)}
//             >
//               <Text style={styles.darkButtonText}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: colors.surfaceMuted,
//     padding: spacing.xl,
//     paddingTop: 18,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: fontWeight.black,
//     color: colors.text,
//   },
//   search: {
//     marginTop: spacing.lg,
//     marginBottom: 0,
//     borderWidth: 1,
//     borderColor: colors.borderSoft,
//   },
//   filterRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: spacing.sm,
//     marginTop: spacing.md,
//     marginBottom: spacing.md,
//     flexWrap: "wrap",
//   },
//   filterBtn: {
//     flexShrink: 1,
//   },
//   filterBtnText: {
//     color: colors.primary,
//     fontWeight: fontWeight.black,
//   },
//   row: {
//     marginTop: spacing.md,
//     borderWidth: 1,
//     borderColor: colors.borderSoft,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: spacing.md,
//   },
//   rowMain: {
//     flex: 1,
//   },
//   name: {
//     fontWeight: fontWeight.black,
//     color: colors.text,
//   },
//   meta: {
//     marginTop: spacing.xs,
//     color: colors.textMuted,
//     fontSize: fontSize.xs,
//   },
//   chev: {
//     fontSize: 22,
//     fontWeight: fontWeight.black,
//     color: "#999",
//   },
//   errorText: {
//     marginTop: spacing.lg,
//     color: colors.danger,
//     fontWeight: fontWeight.heavy,
//   },
//   emptyText: {
//     marginTop: spacing.lg,
//     color: colors.textMuted,
//   },
//   footerLoader: {
//     paddingVertical: spacing.lg,
//   },
//   darkButton: {
//     backgroundColor: "#111",
//   },
//   darkButtonText: {
//     color: colors.primaryTextOn,
//     fontWeight: fontWeight.black,
//   },
//   backBtn: {
//     marginTop: spacing.md,
//   },
//   modalList: {
//     maxHeight: 320,
//   },
//   modalCloseBtn: {
//     marginTop: spacing.md,
//   },
// });