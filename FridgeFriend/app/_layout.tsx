import React from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { ThemeProvider, useTheme } from "../lib/theme";

function AppStack() {
  const { loaded, colors } = useTheme();

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack initialRouteName="LoginScreen">
      <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="BarcodeScanner" options={{ headerShown: false }} />
      <Stack.Screen name="CreateAccount" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}