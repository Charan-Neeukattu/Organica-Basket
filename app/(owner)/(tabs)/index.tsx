import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal, Linking, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { supabase } from "../../../lib/supabase";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";

export default function OwnerDashboard() {
  const [store, setStore] = useState<any>(null);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const router = useRouter();

  const productCardScale = useSharedValue(1);
  const productCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: productCardScale.value }],
  }));

  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  useEffect(() => {
    // Other initializations if any
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storeData } = await supabase.from("stores").select("*").eq("owner_id", user.id).single();
      setStore(storeData);

      if (storeData) {
        const [prodCount, orderData] = await Promise.all([
          supabase.from("products").select("*", { count: 'exact', head: true }).eq("store_id", storeData.id),
          supabase.from("orders").select("*, profiles!user_id(full_name, phone_number)").eq("store_id", storeData.id).eq("status", "pending").order("created_at", { ascending: false })
        ]);
        
        setStats({ 
          products: prodCount.count || 0, 
          orders: orderData.data?.length || 0, 
          revenue: 0 
        });
        setPendingOrders(orderData.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) {
      console.error("Update error:", error);
      alert("Error updating order: " + error.message);
    } else {
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      setStats(prev => ({ ...prev, orders: prev.orders - 1 }));
    }
  };

  const toggleOrdering = async () => {
    if (!store) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newStatus = !store.is_accepting_orders;
    
    const { error } = await supabase
      .from("stores")
      .update({ is_accepting_orders: newStatus })
      .eq("id", store.id);

    if (!error) {
      setStore({ ...store, is_accepting_orders: newStatus });
    }
  };

  const getCustomerProfile = (order: any) => {
    if (!order?.profiles) return null;
    return Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#4A6038" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        
        <Animated.View entering={FadeInDown} style={styles.header}>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.storeName}>{store?.name || "Organic Store"}</Text>
          
          {/* Master Harvest Switch */}
          <View style={[styles.harvestControl, store?.is_accepting_orders ? styles.harvestActive : styles.harvestInactive]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.harvestTitle}>
                {store?.is_accepting_orders ? "Ordering is LIVE" : "Ordering is CLOSED"}
              </Text>
              <Text style={styles.harvestSub}>
                {store?.is_accepting_orders 
                  ? "Customers can place weekly orders now." 
                  : "Update your inventory before going live."}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleOrdering} style={styles.switchContainer}>
              <View style={[styles.switchTrack, store?.is_accepting_orders ? { backgroundColor: "#fff" } : null]}>
                <Animated.View style={[styles.switchThumb, store?.is_accepting_orders ? { alignSelf: 'flex-end', backgroundColor: "#27AE60" } : null]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Active Broadcast Card */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <Ionicons name="megaphone-outline" size={16} color="#4A6038" />
              <Text style={styles.broadcastTitle}>Live Broadcast</Text>
            </View>
            <Text style={styles.broadcastMessage}>
              {store?.status_message || "No active status message set. Go to Profile to update."}
            </Text>
            
            <View style={styles.broadcastDivider} />
            
            <View style={styles.broadcastFooter}>
              <View style={styles.broadcastDateRow}>
                <Ionicons name="calendar-outline" size={14} color="#FF8C42" />
                <Text style={styles.broadcastDateLabel}>Next Delivery:</Text>
              </View>
              <Text style={styles.broadcastDateValue}>{store?.next_delivery_date || "Not set"}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Pressable 
            style={{ flex: 1 }}
            onPressIn={() => {
              productCardScale.value = withTiming(0.975, {
                duration: 200,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              });
            }}
            onPressOut={() => {
              productCardScale.value = withTiming(1, {
                duration: 200,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              });
            }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(owner)/(tabs)/inventory?category=All");
            }}
          >
            <Animated.View entering={FadeInUp.delay(200)} style={[styles.statCard, productCardAnimatedStyle]}>
              <Ionicons name="cube-outline" size={24} color="#4A6038" />
              <Text style={styles.statVal}>{stats.products}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </Animated.View>
          </Pressable>
          <Animated.View entering={FadeInUp.delay(300)} style={styles.statCard}>
            <Ionicons name="receipt-outline" size={24} color="#4A6038" />
            <Text style={styles.statVal}>{stats.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(400)} style={styles.statCard}>
            <Ionicons name="wallet-outline" size={24} color="#4A6038" />
            <Text style={styles.statVal}>₹{stats.revenue}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </Animated.View>
        </View>

        {/* Pending Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Orders</Text>
            <TouchableOpacity onPress={fetchDashboardData}>
              <Ionicons name="refresh-outline" size={20} color="#4A6038" />
            </TouchableOpacity>
          </View>

          {pendingOrders.length === 0 ? (
            <Animated.View entering={FadeInUp.delay(300)} style={styles.emptyOrdersCard}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={48} color="#C0CDB8" />
              <Text style={styles.emptyOrdersTitle}>All Packed!</Text>
              <Text style={styles.emptyOrdersSub}>No pending orders to fulfill right now.</Text>
            </Animated.View>
          ) : (
            pendingOrders.map((order, i) => (
              <Animated.View key={order.id} entering={FadeInUp.delay(300 + (i * 100))} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.customerAvatarBox}>
                    <Text style={styles.avatarInitial}>{getCustomerProfile(order)?.full_name?.charAt(0) || "C"}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.customerName}>{getCustomerProfile(order)?.full_name || "Customer"}</Text>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={12} color="#8A998A" />
                      <Text style={styles.orderTime}>
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.amountBadge}>
                    <Text style={styles.amountText}>₹{order.total_amount}</Text>
                  </View>
                </View>

                <View style={styles.orderMiddle}>
                   <View style={styles.itemsSummaryPill}>
                      <Ionicons name="basket" size={14} color="#4A6038" />
                      <Text style={styles.itemsSummaryText}>
                        {Array.isArray(order.items) ? order.items.length : 0} items for harvest
                      </Text>
                   </View>
                </View>
                
                <View style={styles.orderActions}>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedOrder(order);
                      setShowOrderModal(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.detailsBtn}
                  >
                    <Ionicons name="eye-outline" size={16} color="#4A6038" style={{ marginRight: 6 }} />
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => updateOrderStatus(order.id, "delivered")}
                    style={styles.packBtn}
                  >
                    <Text style={styles.packBtnText}>Mark Delivered</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))
          )}
        </View>

        {/* Recent Tips */}
        <View style={styles.tipCard}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={30} color="#F1C40F" />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.tipTitle}>Boost Your Sales</Text>
            <Text style={styles.tipDesc}>Stores with high-quality photos get 3x more orders. Update your inventory today!</Text>
          </View>
        </View>

      </ScrollView>

      {/* Order Detail Modal */}
      <Modal visible={showOrderModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fulfillment Details</Text>
            <TouchableOpacity onPress={() => setShowOrderModal(false)}>
              <Ionicons name="close-circle" size={28} color="#8A998A" />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Customer Contact */}
              <View style={styles.customerCard}>
                <View style={styles.customerIcon}>
                  <Ionicons name="person" size={24} color="#4A6038" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerLabel}>Ordering Customer</Text>
                  <Text style={styles.customerValue}>{getCustomerProfile(selectedOrder)?.full_name || "Customer"}</Text>
                  <Text style={styles.customerPhone}>{getCustomerProfile(selectedOrder)?.phone_number || "No phone provided"}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.callButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const phone = getCustomerProfile(selectedOrder)?.phone_number;
                    if (phone) {
                      Linking.openURL(`tel:${phone}`);
                    } else {
                      alert("No phone number provided");
                    }
                  }}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Delivery Address */}
              <View style={styles.detailSection}>
                <View style={styles.detailHeader}>
                  <Ionicons name="location" size={18} color="#FF8C42" />
                  <Text style={styles.detailTitle}>Delivery Destination</Text>
                </View>
                <View style={styles.addressBox}>
                   <Text style={styles.addressLabel}>{selectedOrder.delivery_address?.label}</Text>
                   <Text style={styles.addressText}>
                     {selectedOrder.delivery_address?.apartment}, {selectedOrder.delivery_address?.street}
                   </Text>
                   <Text style={styles.addressPincode}>Pincode: {selectedOrder.delivery_address?.pincode}</Text>
                </View>
              </View>

              {/* Items List */}
              <View style={styles.detailSection}>
                <View style={styles.detailHeader}>
                  <Ionicons name="basket" size={18} color="#4A6038" />
                  <Text style={styles.detailTitle}>Harvest Items</Text>
                </View>
                <View style={styles.itemsList}>
                  {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{item.quantity}x</Text>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                    </View>
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Revenue</Text>
                    <Text style={styles.totalValue}>₹{selectedOrder.total_amount}</Text>
                  </View>
                </View>
              </View>

              <View style={{ height: 20 }} />

              <TouchableOpacity 
                style={styles.completeOrderBtn}
                onPress={() => {
                  updateOrderStatus(selectedOrder.id, "delivered");
                  setShowOrderModal(false);
                }}
              >
                <Text style={styles.completeOrderBtnText}>Mark as Delivered</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6E9" },
  scroll: { padding: 24, paddingBottom: 24 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 32 },
  welcome: { fontSize: 16, color: "#8A998A", marginBottom: 4 },
  storeName: { fontSize: 32, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: "700", color: "#1E261E", marginBottom: 20 },
  
  // Harvest Switch Styles
  harvestControl: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    gap: 16,
  },
  harvestActive: { backgroundColor: "#27AE60" },
  harvestInactive: { backgroundColor: "#2D382D" },
  harvestTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  harvestSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  switchContainer: { width: 50, height: 30 },
  switchTrack: { width: 50, height: 28, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 14, padding: 2, justifyContent: "center" },
  switchThumb: { width: 24, height: 24, backgroundColor: "#fff", borderRadius: 12 },
  
  // Broadcast Card
  broadcastCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, marginTop: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 },
  broadcastHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  broadcastTitle: { fontSize: 13, fontWeight: "700", color: "#4A6038", letterSpacing: 0.5 },
  broadcastMessage: { fontSize: 15, color: "#1E261E", lineHeight: 22, fontStyle: "italic" },
  broadcastDivider: { height: 1, backgroundColor: "#F0F2D9", marginVertical: 12 },
  broadcastFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  broadcastDateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  broadcastDateLabel: { fontSize: 12, fontWeight: "600", color: "#8A998A" },
  broadcastDateValue: { fontSize: 13, fontWeight: "800", color: "#1E261E" },
  
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 32 },
  statCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  statVal: { fontSize: 20, fontWeight: "800", color: "#1E261E", marginTop: 8 },
  statLabel: { fontSize: 11, color: "#8A998A", fontWeight: "600" },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#1E261E" },
  emptyOrdersCard: { backgroundColor: "#fff", borderRadius: 24, padding: 40, alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#E0E8D8" },
  emptyOrdersTitle: { fontSize: 18, fontWeight: "800", color: "#4A6038", marginTop: 16 },
  emptyOrdersSub: { fontSize: 13, color: "#8A998A", marginTop: 4 },
  orderCard: { backgroundColor: "#fff", borderRadius: 28, padding: 16, marginBottom: 16, shadowColor: "#4A6038", shadowOpacity: 0.05, shadowRadius: 20, elevation: 3, borderWidth: 1, borderColor: "rgba(240, 242, 217, 0.5)" },
  orderHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  customerAvatarBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 18, fontWeight: "900", color: "#4A6038" },
  customerName: { fontSize: 16, fontWeight: "800", color: "#1E261E" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  orderTime: { fontSize: 12, color: "#8A998A", fontWeight: "600" },
  amountBadge: { backgroundColor: "#F4F5E6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  amountText: { fontSize: 14, fontWeight: "900", color: "#4A6038" },
  orderMiddle: { marginBottom: 16 },
  itemsSummaryPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(74, 96, 56, 0.05)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" },
  itemsSummaryText: { fontSize: 12, fontWeight: "700", color: "#4A6038" },
  orderActions: { flexDirection: "row", gap: 10 },
  detailsBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: "#F4F5E6" },
  detailsBtnText: { color: "#4A6038", fontSize: 13, fontWeight: "800" },
  packBtn: { flex: 1.5, backgroundColor: "#4A6038", paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  packBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  tipCard: { flexDirection: "row", backgroundColor: "#2D382D", padding: 20, borderRadius: 24, alignItems: "center" },
  tipTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  tipDesc: { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 18 },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "#F5F6E9", padding: 24, paddingTop: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 32 },
  modalTitle: { fontSize: 24, fontWeight: "800", color: "#1E261E" },
  customerCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 },
  customerIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center" },
  customerLabel: { fontSize: 12, color: "#8A998A", fontWeight: "600", marginBottom: 2 },
  customerValue: { fontSize: 18, fontWeight: "800", color: "#1E261E" },
  customerPhone: { fontSize: 14, color: "#FF8C42", fontWeight: "600", marginTop: 2 },
  callButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#4A6038", justifyContent: "center", alignItems: "center" },
  detailSection: { marginBottom: 24 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  detailTitle: { fontSize: 16, fontWeight: "800", color: "#1E261E" },
  addressBox: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderLeftWidth: 4, borderLeftColor: "#FF8C42" },
  addressLabel: { fontSize: 12, fontWeight: "800", color: "#FF8C42", marginBottom: 4, textTransform: "uppercase" },
  addressText: { fontSize: 15, color: "#1E261E", fontWeight: "600", lineHeight: 22 },
  addressPincode: { fontSize: 13, color: "#8A998A", marginTop: 4 },
  itemsList: { backgroundColor: "#fff", borderRadius: 24, padding: 20 },
  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  itemQty: { fontSize: 14, fontWeight: "800", color: "#4A6038", width: 30 },
  itemName: { fontSize: 15, color: "#1E261E", flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: "700", color: "#1E261E" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F5F6E9", paddingTop: 16, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: "800", color: "#1E261E" },
  totalValue: { fontSize: 18, fontWeight: "900", color: "#4A6038" },
  completeOrderBtn: { backgroundColor: "#4A6038", paddingVertical: 18, borderRadius: 20, alignItems: "center", marginBottom: 20 },
  completeOrderBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
