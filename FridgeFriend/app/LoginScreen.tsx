import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../config/apiConfig";

import { useAppStyles } from "../lib/useAppStyles";
import {
  fontWeight,
  spacing,
  type AppColors,
} from "../styles/tokens";

export default function LoginScreen() {
  const router = useRouter();
  const { colors, formStyles, buttonStyles } = useAppStyles();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", `Welcome, ${data.username}!`);

        router.replace({
          pathname: "/(tabs)",
          params: { user_id: String(data.user_id) },
        });
      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        style={[formStyles.input, styles.input]}
        placeholder="Username"
        placeholderTextColor={colors.textLight}
        onChangeText={setUsername}
        value={username}
        autoCapitalize="none"
      />

      <TextInput
        style={[formStyles.input, styles.input]}
        placeholder="Password"
        placeholderTextColor={colors.textLight}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.accent, styles.button]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => router.push("../CreateAccount")}
        disabled={loading}
      >
        <Text style={styles.linkText}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    title: {
      color: colors.primaryTextOn,
      fontSize: 26,
      fontWeight: fontWeight.bold,
      marginBottom: 30,
    },
    input: {
      width: "80%",
      height: 50,
      marginVertical: spacing.md,
      marginBottom: 0,
    },
    button: {
      marginTop: spacing.xxxl,
      paddingVertical: 15,
      paddingHorizontal: 40,
    },
    buttonText: {
      fontSize: 18,
      fontWeight: fontWeight.medium,
      color: colors.text,
    },
    linkBtn: {
      marginTop: spacing.xxl,
    },
    linkText: {
      color: colors.primaryTextOn,
      fontWeight: fontWeight.heavy,
      textDecorationLine: "underline",
    },
  });
}