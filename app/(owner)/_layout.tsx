import { Stack } from "expo-router";

export default function OwnerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* This contains the bottom tab bar */}
      <Stack.Screen name="(tabs)" />
      
      {/* This is a full-screen modal that covers the tabs */}
      <Stack.Screen 
        name="add-product" 
        options={{ 
          presentation: "modal",
          animation: "slide_from_bottom"
        }} 
      />
      <Stack.Screen 
        name="notifications" 
        options={{ 
          presentation: "card",
          animation: "slide_from_right"
        }} 
      />
    </Stack>
  );
}
