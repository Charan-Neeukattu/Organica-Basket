import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp, SlideInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useCart } from "../../context/CartContext";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { supabase } from "../../lib/supabase";
import * as Haptics from "expo-haptics";
import { showModernAlert } from "../../components/ModernAlert";
import { NotificationService } from "../../lib/notificationService";

export default function BasketScreen() {
  const router = useRouter();
  const { cartItems, updateCart, clearCart, totalItems, totalPrice } = useCart();
  const ACTIVE_GREEN = "#4A6038";
  const ACTIVE_ORANGE = "#FF8C42";

  const [addresses, setAddresses] = React.useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = React.useState<any>(null);
  const [showAddressModal, setShowAddressModal] = React.useState(false);
  const [isPlacing, setIsPlacing] = React.useState(false);
  const [isAddingAddress, setIsAddingAddress] = React.useState(false);

  // New Address State
  const [newLabel, setNewLabel] = React.useState("Home");
  const [newApartment, setNewApartment] = React.useState("");
  const [newStreet, setNewStreet] = React.useState("");
  const [newPincode, setNewPincode] = React.useState("");

  React.useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("location_data")
      .eq("id", user.id)
      .single();

    if (profile?.location_data && Array.isArray(profile.location_data)) {
      setAddresses(profile.location_data);
      if (profile.location_data.length > 0) {
        setSelectedAddress(profile.location_data[0]);
      }
    }
  };

  const handleSaveAddress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newAddr = {
      id: Date.now().toString(),
      label: newLabel,
      apartment: newApartment,
      street: newStreet,
      pincode: newPincode,
      city_state: "Verified Location"
    };

    const updatedAddresses = [...addresses, newAddr];
    
    const { error } = await supabase
      .from("profiles")
      .update({ location_data: updatedAddresses })
      .eq("id", user.id);

    if (!error) {
      setAddresses(updatedAddresses);
      setSelectedAddress(newAddr);
      setIsAddingAddress(false);
      // Reset form
      setNewApartment("");
      setNewStreet("");
      setNewPincode("");
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setShowAddressModal(true);
      return;
    }

    setIsPlacing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showModernAlert({
          title: "Session Expired",
          message: "Please log in again to place your order.",
          type: "error"
        });
        router.replace("/login");
        return;
      }

      const store_id = cartItems[0].store_id;

      // SAFETY CHECK: Re-verify store status right before placement
      const { data: storeStatus } = await supabase
        .from("stores")
        .select("is_accepting_orders, name, owner_id")
        .eq("id", store_id)
        .single();

      if (!storeStatus?.is_accepting_orders) {
        setIsPlacing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        alert(`Sorry! ${storeStatus?.name || 'The store'} just closed its harvest window and is no longer accepting orders.`);
        return;
      }

      const { data: orderData, error } = await supabase.from("orders").insert({
        user_id: user.id,
        store_id: store_id,
        total_amount: totalPrice,
        status: 'pending',
        items: cartItems,
        delivery_address: selectedAddress // Store full snapshot for history
      }).select().single();

      if (error) throw error;

      // Create a notification for the store owner
      if (storeStatus?.owner_id && orderData?.id) {
        try {
          await NotificationService.createNotification({
            recipient_id: storeStatus.owner_id,
            recipient_role: "owner",
            title: "New Order Received",
            message: "A customer has placed a new order from your store.",
            type: "NEW_ORDER",
            order_id: orderData.id,
            store_id: store_id,
          });
        } catch (notifErr) {
          console.error("Failed to create owner notification:", notifErr);
        }
      }

      showModernAlert({
        title: "Order Placed! 🎉",
        message: "Your harvest is being prepared. Check 'Order History' in your profile to contact the store owner directly.",
        type: "success"
      });

      clearCart();
      router.replace("/order-success" as any);
    } catch (err: any) {
      console.error("Order Placement Error:", err);
      showModernAlert({
        title: "Placement Failed",
        message: err.message || "Something went wrong while placing your order. Please try again.",
        type: "error"
      });
    } finally {
      setIsPlacing(false);
    }
  };

  if (totalItems === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1E261E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Basket</Text>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(200)} style={styles.illustrationContainer}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="basket-outline" size={60} color={ACTIVE_ORANGE} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400)} style={styles.textContainer}>
            <Text style={styles.title}>Your basket is empty</Text>
            <Text style={styles.subtitle}>
              Looks like you haven&apos;t added any fresh harvest to your basket yet.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: ACTIVE_GREEN }]}
              onPress={() => router.push("/(shopper)" as any)}
            >
              <Text style={styles.buttonText}>Start Shopping</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1E261E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Basket</Text>
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.itemList}>
          {cartItems.map((item, index) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(index * 100)} style={styles.cartItemCard}>
              <Image source={{ uri: item.image_url ? item.image_url.split(',')[0] : undefined }} style={styles.itemImage} contentFit="cover" />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price} / {item.unit}</Text>
                
                <View style={styles.qtyRow}>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => updateCart(item, -1)}
                  >
                    <Ionicons name="remove" size={16} color="#1E261E" />
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{item.quantity}</Text>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => updateCart(item, 1)}
                  >
                    <Ionicons name="add" size={16} color="#1E261E" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{totalPrice}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={[styles.summaryValue, { color: "#4A6038" }]}>FREE</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{totalPrice}</Text>
            </View>
          </View>
        </View>

        <View style={styles.deliveryInfoCard}>
          <Ionicons name="time-outline" size={24} color={ACTIVE_ORANGE} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.deliveryInfoTitle}>Scheduled Delivery</Text>
            <Text style={styles.deliveryInfoSub}>Expect delivery within the next harvest window.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.placeOrderBtn, isPlacing && { opacity: 0.8 }]}
          disabled={isPlacing}
          onPress={() => setShowAddressModal(true)}
        >
          {isPlacing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View>
                <Text style={styles.placeOrderText}>Place Order</Text>
                {selectedAddress && (
                  <Text style={styles.selectedAddrLabel} numberOfLines={1}>
                    Delivering to {selectedAddress.label}
                  </Text>
                )}
              </View>
              <View style={styles.placeOrderPriceBox}>
                <Text style={styles.placeOrderPrice}>₹{totalPrice}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Address Selection Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View entering={SlideInDown} style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAddingAddress ? "Add New Address" : "Delivery Destination"}
              </Text>
              <TouchableOpacity onPress={() => {
                if (isAddingAddress) setIsAddingAddress(false);
                else setShowAddressModal(false);
              }}>
                <Ionicons name="close" size={24} color="#1E261E" />
              </TouchableOpacity>
            </View>

            {isAddingAddress ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.addressForm}>
                  <Text style={styles.formLabel}>Address Label</Text>
                  <View style={styles.labelRow}>
                    {["Home", "Work", "Other"].map(lbl => (
                      <TouchableOpacity 
                        key={lbl} 
                        onPress={() => setNewLabel(lbl)}
                        style={[styles.labelBtn, newLabel === lbl && styles.labelBtnActive]}
                      >
                        <Text style={[styles.labelBtnText, newLabel === lbl && styles.labelBtnTextActive]}>{lbl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput 
                    style={styles.formInput} 
                    placeholder="Flat / House No. / Building" 
                    value={newApartment}
                    onChangeText={setNewApartment}
                  />
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="Street / Area" 
                    value={newStreet}
                    onChangeText={setNewStreet}
                  />
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="Pincode" 
                    keyboardType="number-pad"
                    value={newPincode}
                    onChangeText={setNewPincode}
                  />

                  <TouchableOpacity style={styles.saveAddrBtn} onPress={handleSaveAddress}>
                    <Text style={styles.saveAddrText}>Save & Select</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                {addresses.length === 0 ? (
                  <View style={styles.emptyAddressBox}>
                    <Ionicons name="location-outline" size={48} color="#8A998A" />
                    <Text style={styles.emptyAddressTitle}>No addresses found</Text>
                    <Text style={styles.emptyAddressSub}>Add a delivery address to complete your order.</Text>
                    <TouchableOpacity 
                      style={styles.addNewBtnSmall} 
                      onPress={() => setIsAddingAddress(true)}
                    >
                      <Text style={styles.addNewBtnText}>Add Address</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {addresses.map(addr => (
                      <TouchableOpacity 
                        key={addr.id} 
                        style={[styles.addrCard, selectedAddress?.id === addr.id && styles.addrCardSelected]}
                        onPress={() => {
                          setSelectedAddress(addr);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <View style={[styles.addrIcon, selectedAddress?.id === addr.id && { backgroundColor: ACTIVE_ORANGE }]}>
                          <Ionicons 
                            name={addr.label === "Home" ? "home" : addr.label === "Work" ? "briefcase" : "location"} 
                            size={20} 
                            color={selectedAddress?.id === addr.id ? "#fff" : "#8A998A"} 
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addrLabel}>{addr.label}</Text>
                          <Text style={styles.addrFull} numberOfLines={2}>
                            {addr.apartment}, {addr.street}, {addr.pincode}
                          </Text>
                        </View>
                        {selectedAddress?.id === addr.id && (
                          <Ionicons name="checkmark-circle" size={24} color={ACTIVE_ORANGE} />
                        )}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity 
                      style={styles.addNewInline}
                      onPress={() => setIsAddingAddress(true)}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={ACTIVE_GREEN} />
                      <Text style={styles.addNewInlineText}>Add another address</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}

                <TouchableOpacity 
                  style={[styles.confirmAddrBtn, !selectedAddress && { opacity: 0.5 }]}
                  disabled={!selectedAddress}
                  onPress={() => {
                    if (!cartItems || cartItems.length === 0) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const storeName = cartItems[0]?.store_name || "the store";
                    
                    // iOS Fix: Close current modal before opening the next one to avoid layer conflicts
                    setShowAddressModal(false);
                    
                    setTimeout(() => {
                      showModernAlert({
                        title: "Confirm Order?",
                        message: `Are you sure you want to place this order from ${storeName}?`,
                        type: "confirm",
                        onConfirm: () => {
                          handlePlaceOrder();
                        },
                        onCancel: () => {
                          // Optional: reopen address modal if cancelled
                          setShowAddressModal(true);
                        }
                      });
                    }, Platform.OS === 'ios' ? 500 : 0);
                  }}
                >
                  <Text style={styles.confirmAddrText}>Confirm & Place Order</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6E9" },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#1E261E", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  clearText: { color: "#FF6B6B", fontWeight: "700", fontSize: 14 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 140 },
  itemList: { gap: 16, marginTop: 10 },
  cartItemCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 24, padding: 12, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  itemImage: { width: 80, height: 80, borderRadius: 16, backgroundColor: "#F4F5E6" },
  itemDetails: { flex: 1, marginLeft: 16 },
  itemName: { fontSize: 16, fontWeight: "800", color: "#1E261E", marginBottom: 4 },
  itemPrice: { fontSize: 13, color: "#8A998A", marginBottom: 12 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F5F6E9", justifyContent: "center", alignItems: "center" },
  qtyVal: { fontSize: 15, fontWeight: "800", color: "#1E261E" },
  itemTotal: { fontSize: 16, fontWeight: "800", color: "#4A6038" },
  summaryContainer: { marginTop: 32 },
  summaryTitle: { fontSize: 18, fontWeight: "800", color: "#1E261E", marginBottom: 16 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: "#8A998A", fontWeight: "600" },
  summaryValue: { fontSize: 14, fontWeight: "800", color: "#1E261E" },
  divider: { height: 1, backgroundColor: "#F5F6E9", marginVertical: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 16, fontWeight: "800", color: "#1E261E" },
  totalValue: { fontSize: 22, fontWeight: "800", color: "#1E261E" },
  deliveryInfoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF4ED", borderRadius: 20, padding: 16, marginTop: 24, borderWidth: 1, borderColor: "#FFEBDD" },
  deliveryInfoTitle: { fontSize: 14, fontWeight: "800", color: "#FF8C42" },
  deliveryInfoSub: { fontSize: 12, color: "#B38566", marginTop: 2 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20, backgroundColor: "rgba(245, 246, 233, 0.9)" },
  placeOrderBtn: { backgroundColor: "#4A6038", height: 64, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, shadowColor: "#4A6038", shadowOpacity: 0.2, shadowRadius: 15, elevation: 8 },
  placeOrderText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  placeOrderPriceBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  placeOrderPrice: { color: "#fff", fontSize: 16, fontWeight: "800" },
  selectedAddrLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 400, maxHeight: "80%", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E261E" },
  addrCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: "#F5F6E9", marginBottom: 12, gap: 16, borderWidth: 2, borderColor: "transparent" },
  addrCardSelected: { borderColor: "#FF8C42", backgroundColor: "#FFF2EA" },
  addrIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  addrLabel: { fontSize: 15, fontWeight: "800", color: "#1E261E", marginBottom: 2 },
  addrFull: { fontSize: 13, color: "#6B7A6B", lineHeight: 18 },
  addNewInline: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, marginTop: 8 },
  addNewInlineText: { fontSize: 15, fontWeight: "700", color: "#4A6038" },
  confirmAddrBtn: { backgroundColor: "#1E261E", height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", marginTop: 20 },
  confirmAddrText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  emptyAddressBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyAddressTitle: { fontSize: 18, fontWeight: "800", color: "#1E261E", marginTop: 16, marginBottom: 8 },
  emptyAddressSub: { fontSize: 14, color: "#8A998A", textAlign: "center", marginBottom: 24 },
  addNewBtnSmall: { backgroundColor: "#4A6038", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  addNewBtnText: { color: "#fff", fontWeight: "700" },
  addressForm: { gap: 16 },
  formLabel: { fontSize: 14, fontWeight: "700", color: "#1E261E", marginBottom: -4 },
  labelRow: { flexDirection: "row", gap: 10 },
  labelBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#E0E8D8", alignItems: "center" },
  labelBtnActive: { backgroundColor: "#FF8C42", borderColor: "#FF8C42" },
  labelBtnText: { fontSize: 13, fontWeight: "700", color: "#8A998A" },
  labelBtnTextActive: { color: "#fff" },
  formInput: { backgroundColor: "#F5F6E9", borderRadius: 16, padding: 16, fontSize: 15 },
  saveAddrBtn: { backgroundColor: "#4A6038", height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", marginTop: 10 },
  saveAddrText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, marginTop: -60 },
  illustrationContainer: { marginBottom: 32 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", shadowColor: "#FF8C42", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  textContainer: { alignItems: "center", marginBottom: 40 },
  title: { fontSize: 22, fontWeight: "800", color: "#1E261E", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 15, color: "#6B7A6B", textAlign: "center", lineHeight: 22 },
  button: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 18, borderRadius: 20, shadowColor: "#4A6038", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
