import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform, StyleSheet, DeviceEventEmitter, TouchableOpacity, Text } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  FadeIn
} from "react-native-reanimated";

export default function TabLayout() {
  const ACTIVE_ORANGE = "#FF8C42";
  const INACTIVE_GRAY = "#8A998A";

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Listen for scroll events from the Home screen
    const subscription = DeviceEventEmitter.addListener('TOGGLE_TAB_BAR', (visibleValue) => {
      // visibleValue comes in as 1 (show) or 0 (hide)
      translateY.value = withSpring(visibleValue === 1 ? 0 : 100, {
        damping: 20,
        stiffness: 90
      });
      opacity.value = withSpring(visibleValue === 1 ? 1 : 0);
    });

    return () => subscription.remove();
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: ACTIVE_ORANGE,
        tabBarInactiveTintColor: INACTIVE_GRAY,
        tabBarStyle: {
          display: 'none' // We'll use a custom component to allow animation
        }
      }}
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index].name;
        // Hide tab bar on basket screen to avoid overlapping with Place Order button
        if (currentRoute === 'basket') return null;

        return (
          <Animated.View style={[styles.customTabBarContainer, animatedStyle]}>
          <BlurView intensity={90} tint="light" style={styles.blurContainer}>
            {props.state.routes.map((route, index) => {
              const isFocused = props.state.index === index;
              
              // Only show the main tabs in the custom tab bar
              if (!['index', 'basket', 'profile'].includes(route.name)) return null;

              const onPress = () => {
                const event = props.navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  props.navigation.navigate(route.name);
                }
              };

              let iconName: any;
              let IconComponent = Ionicons;

              if (route.name === 'index') {
                iconName = isFocused ? 'home' : 'home-outline';
              } else if (route.name === 'basket') {
                IconComponent = MaterialCommunityIcons as any;
                iconName = isFocused ? 'basket' : 'basket-outline';
              } else if (route.name === 'profile') {
                iconName = isFocused ? 'person' : 'person-outline';
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={styles.tabItem}
                  activeOpacity={0.7}
                >
                  {isFocused && (
                    <Animated.View 
                      entering={FadeIn.duration(200)}
                      style={styles.activePill} 
                    />
                  )}
                  <IconComponent
                    name={iconName}
                    size={22}
                    color={isFocused ? ACTIVE_ORANGE : INACTIVE_GRAY}
                  />
                  <Text style={[
                    styles.tabLabel, 
                    { color: isFocused ? ACTIVE_ORANGE : INACTIVE_GRAY }
                  ]}>
                    {route.name === 'index' ? 'HOME' : route.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </BlurView>
        </Animated.View>
      );
    }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="basket" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="category/[category]" options={{ href: null }} />
      <Tabs.Screen name="product/[name]" options={{ href: null }} />
    </Tabs>
  );
}


const styles = StyleSheet.create({
  customTabBarContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 24,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  blurContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 28,
    height: 76,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-around",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  activePill: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF2EA", // Very soft orange tint
    zIndex: -1,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
