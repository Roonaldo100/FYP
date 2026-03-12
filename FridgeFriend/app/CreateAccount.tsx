import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { commonStyles } from "../styles/common";
import { formStyles } from "../styles/forms";
import { buttonStyles } from "../styles/buttons";
import { colors, fontSize, fontWeight, spacing } from "../styles/tokens";

export default function CreateAccount() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const onCreate = async () => {
    const u = username.trim();
    if (!u) return Alert.alert("Error", "Enter a username");
    if (u.length > 30) return Alert.alert("Error", "Username max length is 30");
    if (!password || password.length < 6) {
      return Alert.alert("Error", "Password must be at least 6 characters");
    }
    if (password !== password2) {
      return Alert.alert("Error", "Passwords do not match");
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert("Create account failed", data?.message || "Unable to create account");
        return;
      }

      Alert.alert("Created", `Welcome, ${data.username}!`);

      router.replace({
        pathname: "/(tabs)",
        params: { user_id: String(data.user_id) },
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>

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
        placeholder="Password (min 6 chars)"
        placeholderTextColor={colors.textLight}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TextInput
        style={[formStyles.input, styles.input]}
        placeholder="Confirm password"
        placeholderTextColor={colors.textLight}
        secureTextEntry
        onChangeText={setPassword2}
        value={password2}
      />

      <TouchableOpacity
        style={[buttonStyles.base, buttonStyles.accent, styles.createButton]}
        onPress={onCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.createButtonText}>Create</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => router.back()}
        disabled={loading}
      >
        <Text style={styles.linkText}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screenPrimary,
    alignItems: "center",
    justifyContent: "center",
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
  createButton: {
    marginTop: spacing.xxxl,
    paddingVertical: 15,
    paddingHorizontal: 40,
  },
  createButtonText: {
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