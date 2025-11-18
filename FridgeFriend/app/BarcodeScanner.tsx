import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

export default function BarcodeScanner() {
  const { user_id } = useLocalSearchParams<{ user_id: string }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request camera permission on load
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  // Handle the barcode result
  const handleScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
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

      // Ask user if they want to add this item
      Alert.alert(
        "Product Found",
        `Product: ${data.product_name}\nStore: ${data.store_name}`,
        [
          { text: "Cancel", onPress: () => setScanned(false), style: "cancel" },
          {
            text: "Add Item",
            onPress: async () => {
              // TEMP expiry date (user will enter later)
              const defaultExpiry = new Date();
              defaultExpiry.setDate(defaultExpiry.getDate() + 5);

              const expiryDate = defaultExpiry.toISOString().split("T")[0];

              await fetch(`${API_BASE_URL}/user/addProduct`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user_id,
                  productId: data.product_id,
                  storeId: data.store_id,
                  expiryDate,
                }),
              });

              Alert.alert("Added!", "Item added to your fridge.");
              router.back(); // return to the Fridge screen
            },
          },
        ]
      );

    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to process barcode.");
    } finally {
      setLoading(false);
    }
  };

  // Permission states
  if (!permission) {
    return <Text>Requesting camera permission…</Text>;
  }

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

//////////////////////////////////////////////////////////////////////////////////////

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanAgainContainer: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});