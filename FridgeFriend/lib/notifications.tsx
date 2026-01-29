import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Required by newer SDK typings
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

export async function registerForLocalNotificationsAsync(): Promise<boolean> {
  try {
    if (Platform.OS === "android" && !channelReady) {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
      channelReady = true;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (e) {
    console.error("Notification setup error:", e);
    return false;
  }
}

export async function sendImmediateExpiryTestNotification(productName: string) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "FridgeFriend",
      body: `${productName} is going to expire in 0 days.`,
      sound: true,
    },
    trigger: null,
  });
}
