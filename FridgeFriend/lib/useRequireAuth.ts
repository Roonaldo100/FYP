import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

export function useRequireAuth(expectedUserId?: string) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          const sessionUserId = await SecureStore.getItemAsync("sessionUserId");

          if (!sessionUserId) {
            router.dismissAll();
            router.replace("/");
            return;
          }

          if (expectedUserId && String(sessionUserId) !== String(expectedUserId)) {
            router.dismissAll();
            router.replace("/");
            return;
          }

          if (active) setChecked(true);
        } catch (e) {
          console.error("Auth check error:", e);
          router.dismissAll();
          router.replace("/");
        }
      };

      setChecked(false);
      run();

      return () => {
        active = false;
      };
    }, [expectedUserId, router])
  );

  return checked;
}