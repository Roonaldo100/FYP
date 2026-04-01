import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";

import { commonStyles } from "../styles/common";
import { buttonStyles } from "../styles/buttons";
import { colors, fontWeight, radius, spacing } from "../styles/tokens";
import {
  extractExpiryDateFromText,
  formatCompactDisplayDate,
} from "../lib/dateUtils";

let extractTextFromImage: ((uri: string) => Promise<string[]>) | null = null;

try {
  const mod = require("expo-text-extractor");
  extractTextFromImage = mod.extractTextFromImage;
} catch {
  extractTextFromImage = null;
}

export default function ExpiryDateScanner() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);

  const { user_id, product_id, product_name } = useLocalSearchParams<{
    user_id?: string;
    product_id?: string;
    product_name?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;

    if (!extractTextFromImage) {
      Alert.alert(
        "OCR unavailable",
        "The OCR native module is not available in this build. Rebuild the app with expo run:android or expo run:ios and open the development build, not Expo Go."
      );
      return;
    }

    try {
      setBusy(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        Alert.alert("Error", "No photo was captured.");
        return;
      }

      const lines = await extractTextFromImage(photo.uri);
      const rawText = Array.isArray(lines) ? lines.join("\n") : "";

      console.log("OCR TEXT:", rawText);

      const parsedExpiry = extractExpiryDateFromText(rawText);

      if (!parsedExpiry) {
        Alert.alert(
          "No expiry found",
          "I couldn't detect a valid expiry date. Supported examples include 20260425, 25042026, 25/04/26, 25/04/2026, 04 APR 2026, 11.2028, and 31.08."
        );
        return;
      }

      Alert.alert("Expiry found", `Detected expiry: ${formatCompactDisplayDate(parsedExpiry)}`, [
        {
          text: "Use date",
          onPress: () => {
            router.replace({
              pathname: "/AddItemToFridge",
              params: {
                user_id: String(user_id ?? ""),
                product_id: String(product_id ?? ""),
                product_name: String(product_name ?? ""),
                scanned_expiry: parsedExpiry,
              },
            });
          },
        },
        {
          text: "Scan again",
          style: "cancel",
        },
      ]);
    } catch (e) {
      console.error("Expiry scan error:", e);
      Alert.alert("Error", "Unable to scan expiry date.");
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={commonStyles.centered}>
        <Text>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={commonStyles.centered}>
        <Text>No access to camera.</Text>
        <TouchableOpacity
          style={[buttonStyles.base, buttonStyles.accent, styles.permissionBtn]}
          onPress={requestPermission}
        >
          <Text style={buttonStyles.accentText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View style={styles.overlay}>
        <View>
          <Text style={styles.title}>Scan expiry date</Text>
          <Text style={styles.helpText}>Aim the camera at the printed expiry.</Text>
          <Text style={styles.helpText}>
            Supported examples: 20260425, 25042026, 25/04/26, 25/04/2026, 04 APR 2026, 11.2028, 31.08
          </Text>
        </View>

        <View style={styles.guideWrap}>
          <View style={styles.guideBox} />
        </View>

        <View style={styles.actionsWrap}>
          {busy ? (
            <View style={styles.busyWrap}>
              <ActivityIndicator size="large" color={colors.primaryTextOn} />
              <Text style={styles.busyText}>Scanning…</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.accent, styles.captureBtn]}
                onPress={handleCapture}
              >
                <Text style={buttonStyles.accentText}>Capture</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[buttonStyles.base, buttonStyles.light]}
                onPress={() => router.back()}
              >
                <Text style={styles.backText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "space-between",
  },
  title: {
    color: colors.primaryTextOn,
    fontSize: 22,
    fontWeight: fontWeight.black,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  helpText: {
    color: colors.primaryTextOn,
    marginBottom: spacing.xs,
  },
  guideWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  guideBox: {
    width: "88%",
    height: 150,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: radius.md,
    backgroundColor: "transparent",
  },
  actionsWrap: {
    minHeight: 120,
    justifyContent: "flex-end",
  },
  busyWrap: {
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  busyText: {
    color: colors.primaryTextOn,
    marginTop: spacing.sm,
  },
  captureBtn: {
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.primary,
    fontWeight: fontWeight.black,
    textAlign: "center",
  },
  permissionBtn: {
    marginTop: spacing.md,
  },
});