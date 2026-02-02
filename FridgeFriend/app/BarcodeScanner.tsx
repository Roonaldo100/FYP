import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

import { 
  registerForLocalNotificationsAsync, 
  sendExpiryNotification
} from "../lib/notifications";

export default function BarcodeScanner() {
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request camera permission on load
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  // Pre-register local notifications (so the first notify works cleanly)
  useEffect(() => {
    registerForLocalNotificationsAsync().catch(() => {});
  }, []);

  const handleScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;

    if (!user_id) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/LoginScreen");
      return;
    }

    setScanned(true);

    const barcode = result.data;
    console.log("Scanned barcode:", barcode);

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      const data = await response.json();
      console.log("Scan response:", data);

      if (!data.found) {
        Alert.alert("Not Found", "This barcode is not recognized.");
        setScanned(false);
        return;
      }

      // If product exists in OFF but not in your DB, route to classification UI
      if (data.needs_classification) {
        setLoading(false);
        router.push({
          pathname: "/NewProductClassification",
          params: {
            user_id: String(user_id),
            barcode: String(data.barcode ?? barcode),
            product_name: String(data.product_name ?? "Unnamed Product"),
            store_id: String(data.store_id),
            store_name: String(data.store_name ?? "Unknown"),
          },
        });
        return;
      }

      Alert.alert(
        "Product Found",
        `Product: ${data.product_name}\nStore: ${data.store_name}`,
        [
          { text: "Cancel", onPress: () => setScanned(false), style: "cancel" },
          {
            text: "Add Item",
            onPress: async () => {
              const defaultExpiry = new Date();
              defaultExpiry.setDate(defaultExpiry.getDate() + 5);
              const expiryDate = defaultExpiry.toISOString().split("T")[0];

              // Insert into user_products
              const addResp = await fetch(`${API_BASE_URL}/user/addProduct`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user_id,
                  productId: data.product_id,
                  storeId: data.store_id,
                  expiryDate,
                }),
              });

              if (!addResp.ok) {
                const txt = await addResp.text().catch(() => "");
                console.error("Add product failed:", addResp.status, txt);
                Alert.alert("Error", "Failed to add product.");
                setScanned(false);
                return;
              }

              const inserted = await addResp.json();
              const userProductId = inserted.user_product_id;

              const daysLeft: number = Number(inserted.days_left);
              const effectivePeriodDays: number = Number(inserted.effective_period_days);

              // Only notify if DB says it is due
              if (daysLeft <= effectivePeriodDays) {
                const ok = await registerForLocalNotificationsAsync();
                if (ok) {
                  await sendExpiryNotification(data.product_name, daysLeft);

                  if (userProductId) {
                    await fetch(
                      `${API_BASE_URL}/user_products/${userProductId}/markNotified`,
                      { method: "POST", headers: { "Content-Type": "application/json" } }
                    );
                  }
                }
              }

              Alert.alert("Added!", "Item added to your fridge.");
              router.back();
            },
          },
        ]
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to process barcode.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  // Permission states
  if (!permission) return <Text>Requesting camera permission…</Text>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>No access to camera.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "qr", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={scanned ? undefined : handleScanned}
      />

      {scanned && (
        <View style={styles.scanAgainContainer}>
          <Button title="Scan Again" onPress={() => setScanned(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanAgainContainer: { position: "absolute", bottom: 40, alignSelf: "center" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});
