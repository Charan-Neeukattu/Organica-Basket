import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { NotificationService, Notification, formatRelativeTime } from "../../lib/notificationService";

export default function ShopperNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const ACTIVE_ORANGE = "#FF8C42";

  const fetchNotificationsData = useCallback(async (uid: string) => {
    try {
      const data = await NotificationService.fetchNotifications(uid, "customer");
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchNotificationsData(user.id);

        // Real-time subscription
        unsubscribe = NotificationService.subscribeToNotifications(
          user.id,
          "customer",
          (newNotif) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setNotifications((prev) => {
              // Avoid duplicate inserts
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        );
      } else {
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchNotificationsData]);

  const handleRefresh = () => {
    if (userId) {
      setRefreshing(true);
      fetchNotificationsData(userId);
    }
  };

  const handleMarkAsRead = async (id: string, isAlreadyRead: boolean) => {
    if (isAlreadyRead) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    try {
      await NotificationService.markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert state on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId || notifications.every((n) => n.is_read)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic UI update
    const previousNotifications = [...notifications];
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await NotificationService.markAllAsRead(userId, "customer");
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      // Revert state on error
      setNotifications(previousNotifications);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACTIVE_ORANGE} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1E261E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn} activeOpacity={0.7}>
              <Text style={[styles.markAllText, { color: ACTIVE_ORANGE }]}>Read All</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[ACTIVE_ORANGE]}
            tintColor={ACTIVE_ORANGE}
          />
        }
      >
        {notifications.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="bell-off-outline" size={50} color={ACTIVE_ORANGE} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              You don&apos;t have any notifications right now.
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.listContainer}>
            {notifications.map((item, index) => {
              const isUnread = !item.is_read;
              
              return (
                <Animated.View
                  key={item.id}
                  entering={FadeInUp.delay(Math.min(index * 60, 400))}
                  layout={Layout.springify().damping(20).stiffness(90)}
                >
                  <TouchableOpacity
                    style={[
                      styles.card,
                      isUnread ? styles.unreadCard : styles.readCard,
                    ]}
                    onPress={() => handleMarkAsRead(item.id, item.is_read)}
                    activeOpacity={0.85}
                  >
                    {/* Left Icon */}
                    <View
                      style={[
                        styles.iconContainer,
                        {
                          backgroundColor: isUnread
                            ? "rgba(255, 140, 66, 0.15)"
                            : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.type === "ORDER_DELIVERED"
                            ? "checkmark-circle-outline"
                            : "notifications-outline"
                        }
                        size={22}
                        color={isUnread ? ACTIVE_ORANGE : "#8A998A"}
                      />
                    </View>

                    {/* Content */}
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        <Text
                          style={[
                            styles.cardTitle,
                            isUnread ? styles.unreadText : styles.readText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.timeText}>
                          {formatRelativeTime(item.created_at)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.cardMessage,
                          isUnread ? styles.unreadMessageText : styles.readMessageText,
                        ]}
                        numberOfLines={3}
                      >
                        {item.message}
                      </Text>
                    </View>

                    {/* Unread dot */}
                    {isUnread && (
                      <View
                        style={[
                          styles.unreadDot,
                          { backgroundColor: ACTIVE_ORANGE },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6E9",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F6E9",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(230, 232, 216, 0.5)",
    backgroundColor: "#F5F6E9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E261E",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  listContainer: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    position: "relative",
  },
  unreadCard: {
    backgroundColor: "#fff",
    borderColor: "rgba(255, 140, 66, 0.2)",
    shadowColor: "#4A6038",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  readCard: {
    backgroundColor: "#EEEBDD",
    borderColor: "#DDDAB8",
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    color: "#1E261E",
  },
  readText: {
    color: "#6B7A6B",
  },
  timeText: {
    fontSize: 11,
    color: "#8A998A",
    fontWeight: "600",
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadMessageText: {
    color: "#4A524A",
    fontWeight: "600",
  },
  readMessageText: {
    color: "#8A998A",
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E261E",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8A998A",
    textAlign: "center",
  },
});
