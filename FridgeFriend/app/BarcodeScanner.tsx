// C:\Users\ruben\Desktop\FYP\FridgeFriend\app\BarcodeScanner.tsx
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

import { registerForLocalNotificationsAsync } from "../lib/notifications";
import { useAppStyles } from "../lib/useAppStyles";
import { spacing, fontWeight, type AppColors } from "../styles/tokens";

export default function BarcodeScanner() {
  const { user_id } = useLocalSearchParams<{ user_id?: string }>();
  const router = useRouter();

  const { colors, commonStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

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
        body: JSON.stringify({ barcode, userId: Number(user_id) }),
      });

      const data = await response.json();
      console.log("Scan response:", data);

      if (!data.found) {
        Alert.alert("Not Found", "This barcode is not recognized.");
        setScanned(false);
        return;
      }

      if (data.needs_classification) {
        setLoading(false);
        router.push({
          pathname: "/NewProductClassification",
          params: {
            user_id: String(user_id),
            barcode: String(data.barcode ?? barcode),
            product_name: String(data.product_name ?? "Unnamed Product"),
          },
        });
        return;
      }

      Alert.alert("Product Found", `Product: ${data.product_name}`, [
        { text: "Cancel", onPress: () => setScanned(false), style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            router.push({
              pathname: "/AddItemToFridge",
              params: {
                user_id: String(user_id),
                product_id: String(data.product_id),
                product_name: String(data.product_name ?? "Unnamed Product"),
              },
            });
          },
        },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to process barcode.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={commonStyles.centered}>
        <Text style={styles.infoText}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={commonStyles.centered}>
        <Text style={styles.infoText}>No access to camera.</Text>
        <View style={styles.permissionButtonWrap}>
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.accent]}
            onPress={requestPermission}
          >
            <Text style={buttonStyles.accentText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={commonStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primaryTextOn} />
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
          <TouchableOpacity
            style={[buttonStyles.base, buttonStyles.light]}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.scanAgainText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    infoText: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
    permissionButtonWrap: {
      marginTop: spacing.md,
    },
    scanAgainContainer: {
      position: "absolute",
      bottom: 40,
      alignSelf: "center",
    },
    scanAgainText: {
      color: colors.primary,
      fontWeight: fontWeight.black,
    },
  });
}