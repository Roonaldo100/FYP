import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack initialRouteName="LoginScreen">
      <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="BarcodeScanner" options={{ headerShown: false }} />
    </Stack>
  );
}
