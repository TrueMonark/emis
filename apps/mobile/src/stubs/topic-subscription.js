// expo-notifications loads its push "topic subscription" native module as soon as it's imported.
// Expo Go on Android doesn't have that module (push notifications were removed from Expo Go in
// SDK 53), so the import crashed the whole app. The app only uses local reminders, never topics:
// this stand-in uses the real module when the app has it (our own builds) and nothing otherwise.
import { requireOptionalNativeModule } from "expo-modules-core";

export default requireOptionalNativeModule("ExpoTopicSubscriptionModule") ?? {
  subscribeToTopicAsync: async () => {
    throw new Error("Topic subscriptions need a development build of the app");
  },
  unsubscribeFromTopicAsync: async () => {
    throw new Error("Topic subscriptions need a development build of the app");
  },
};
