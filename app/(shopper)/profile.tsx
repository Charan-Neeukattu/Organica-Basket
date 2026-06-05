import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { showModernAlert } from "../../components/ModernAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  
  // Address States
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressFormVisible, setAddressFormVisible] = useState(false);
  const [street, setStreet] = useState("");
  const [apartment, setApartment] = useState("");
  const [pincode, setPincode] = useState("");
  const [addressLabel, setAddressLabel] = useState("Home");
  const [cityState, setCityState] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());

  const ACTIVE_ORANGE = "#FF8C42";

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchOrders();
    }, [])
  );

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setUserProfile(data);
      setEditName(data.full_name || "");
      setEditGender(data.gender || "");
      setEditPhone(data.phone_number || "");
      
      let parsedAddresses = [];
      if (Array.isArray(data.location_data)) {
        parsedAddresses = data.location_data;
      } else if (data.location_data) {
        parsedAddresses = [{ id: Date.now().toString(), label: "Home", ...data.location_data }];
      }
      setAddresses(parsedAddresses);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [ordersRes, reviewsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, stores(*, owner:profiles(full_name, phone_number))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("order_id")
        .eq("user_id", user.id)
    ]);

    setOrders(ordersRes.data || []);
    const reviewedIds = new Set((reviewsRes.data || []).map((r: any) => r.order_id));
    setReviewedOrderIds(reviewedIds);
    setOrdersLoading(false);
  };

  const getOwnerProfile = (order: any) => {
    const ownerData = order?.stores?.owner;
    if (!ownerData) return null;
    return Array.isArray(ownerData) ? ownerData[0] : ownerData;
  };

  const openAddressForm = (addr: any = null) => {
    if (addr) {
      setEditingAddressId(addr.id);
      setStreet(addr.street || "");
      setApartment(addr.apartment || "");
      setPincode(addr.pincode || "");
      setAddressLabel(addr.label || "Home");
      setCityState(addr.city_state || "");
    } else {
      setEditingAddressId(null);
      setStreet("");
      setApartment("");
      setPincode("");
      setAddressLabel("Home");
      setCityState("");
    }
    setAddressFormVisible(true);
  };

  const handleSaveAddress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newAddress = {
      id: editingAddressId || Date.now().toString(),
      label: addressLabel,
      street,
      apartment,
      pincode,
      city_state: cityState,
    };

    let updatedAddresses = [...addresses];
    if (editingAddressId) {
      updatedAddresses = updatedAddresses.map(a => a.id === editingAddressId ? newAddress : a);
    } else {
      updatedAddresses.push(newAddress);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ location_data: updatedAddresses }).eq("id", user.id);
    if (error) {
      showModernAlert({ title: "Error", message: error.message, type: "error" });
    } else {
      setAddresses(updatedAddresses);
      setAddressFormVisible(false);
      fetchProfile();
    }
  };

  const handleDeleteAddress = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const updatedAddresses = addresses.filter(a => a.id !== id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ location_data: updatedAddresses }).eq("id", user.id);
    if (!error) {
      setAddresses(updatedAddresses);
      fetchProfile();
    }
  };

  const pickAvatar = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setNewAvatar(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");
      
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);
      
      const fileName = `avatars/${user.id}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('stores').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) {
        throw new Error(error.message);
      }
      const { data: { publicUrl } } = supabase.storage.from('stores').getPublicUrl(data.path);
      return publicUrl;
    } catch (err: any) {

      showModernAlert({ title: "Upload Failed", message: err.message || "Failed to upload image.", type: "error" });
      return null;
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let avatarUrl = userProfile?.avatar_url;
    if (newAvatar) {
      const uploadedUrl = await uploadAvatar(newAvatar);
      if (uploadedUrl) avatarUrl = uploadedUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editName,
        gender: editGender,
        phone_number: editPhone,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    if (error) {
      showModernAlert({ title: "Error", message: error.message, type: "error" });
    } else {
      // Optimistically update the local state so the new avatar shows immediately
      setUserProfile((prev: any) => ({
        ...prev,
        full_name: editName,
        gender: editGender,
        phone_number: editPhone,
        avatar_url: avatarUrl,
      }));
      setIsEditing(false);
      setNewAvatar(null);
      fetchProfile();
      showModernAlert({ title: "Success", message: "Profile updated successfully!", type: "success" });
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    showModernAlert({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      type: "confirm",
      onConfirm: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await supabase.auth.signOut();
        router.replace("/login");
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#C0392B" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.duration(800)} style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: newAvatar || userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.full_name}` }}
              style={styles.avatar}
            />
            {isEditing && (
              <TouchableOpacity onPress={pickAvatar} style={[styles.editBadge, { backgroundColor: ACTIVE_ORANGE }]}>
                <Ionicons name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <TextInput value={editName} onChangeText={setEditName} style={styles.editInput} placeholder="Full Name" />
              <TextInput value={editPhone} onChangeText={setEditPhone} style={styles.editInput} placeholder="Phone Number" keyboardType="phone-pad" />
              <View style={styles.genderEditRow}>
                {["Male", "Female", "Other"].map(g => (
                  <TouchableOpacity 
                    key={g} 
                    onPress={() => setEditGender(g)}
                    style={[styles.genderEditBtn, editGender === g ? { backgroundColor: ACTIVE_ORANGE } : null]}
                  >
                    <Text style={[styles.genderEditText, editGender === g ? { color: "#fff" } : null]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.editActionRow}>
                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdate} style={[styles.saveBtn, { backgroundColor: ACTIVE_ORANGE }]}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.userName}>{userProfile?.full_name || "Organica User"}</Text>
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>{userProfile?.gender || "Gender"}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editProfileBtn}>
                <Text style={{ color: ACTIVE_ORANGE, fontWeight: "700" }}>Edit Profile</Text>
              </TouchableOpacity>
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statNumber}>{orders.length}</Text><Text style={styles.statLabel}>Orders</Text></View>
                <View style={styles.statDivider} /><View style={styles.statItem}><Text style={styles.statNumber}>{addresses.length}</Text><Text style={styles.statLabel}>Addresses</Text></View>
              </View>
            </>
          )}
        </Animated.View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <TouchableOpacity onPress={() => setShowAddressModal(true)} style={styles.menuItem}>
            <View style={styles.menuIconContainer}><Ionicons name="location-outline" size={22} color="#4A6038" /></View>
            <Text style={styles.menuLabel}>My Addresses</Text>
            <Text style={styles.menuValue} numberOfLines={1}>{addresses.length > 0 ? `${addresses.length} Saved` : "Set Location"}</Text>
          </TouchableOpacity>

        </View>

        {/* Order History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Order History</Text>
          {ordersLoading ? (
            <ActivityIndicator color="#4A6038" style={{ marginTop: 20 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyHistory}>
              <MaterialCommunityIcons name="basket-off-outline" size={48} color="#8A998A" />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          ) : (
            orders.map((order, index) => (
              <Animated.View key={order.id} entering={FadeInDown.delay(index * 100)} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.storeThumbBox}>
                    <Image source={{ uri: order.stores?.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e" }} style={styles.storeThumb} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.orderStoreName}>{order.stores?.name}</Text>
                    <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <View style={[styles.statusBadge, order.status === 'delivered' ? styles.statusDelivered : styles.statusPending]}>
                    <Text style={[styles.statusText, order.status === 'delivered' ? { color: "#4A6038" } : { color: "#FF8C42" }]}>
                      {order.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderItemSummary}>{JSON.parse(JSON.stringify(order.items)).length} items • ₹{order.total_amount}</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    {order.status === 'delivered' && (
                      reviewedOrderIds.has(order.id) ? (
                        <View style={styles.reviewedInlineBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#4A6038" />
                          <Text style={styles.reviewedInlineText}>Reviewed</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.reviewBtn}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push({
                              pathname: "/(shopper)/leave-review" as any,
                              params: { orderId: order.id, storeId: order.store_id }
                            });
                          }}
                        >
                          <Text style={styles.reviewBtnText}>Leave Review</Text>
                        </TouchableOpacity>
                      )
                    )}
                    <TouchableOpacity 
                      style={styles.reorderBtn}
                      onPress={() => {
                        setSelectedOrder(order);
                        setShowOrderDetailModal(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.reorderText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Addresses Modal */}
      <Modal visible={showAddressModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Addresses</Text>
            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
              <Ionicons name="close-circle" size={28} color="#C0392B" />
            </TouchableOpacity>
          </View>

          {addressFormVisible ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.addressSectionTitle}>{editingAddressId ? "Edit Address" : "New Address"}</Text>
              
              <View style={styles.addressLabelRow}>
                {["Home", "Work", "Other"].map(lbl => (
                  <TouchableOpacity 
                    key={lbl} 
                    onPress={() => setAddressLabel(lbl)}
                    style={[styles.addressLabelBtn, addressLabel === lbl ? { backgroundColor: ACTIVE_ORANGE, borderColor: ACTIVE_ORANGE } : null]}
                  >
                    <Ionicons name={lbl === "Home" ? "home" : lbl === "Work" ? "briefcase" : "location"} size={14} color={addressLabel === lbl ? "#fff" : "#8A998A"} />
                    <Text style={[styles.addressLabelText, addressLabel === lbl ? { color: "#fff" } : null]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={async () => {
                 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                 let { status } = await Location.requestForegroundPermissionsAsync();
                 if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    const rev = await Location.reverseGeocodeAsync(loc.coords);
                    setCityState(`${rev[0].city || rev[0].region}, ${rev[0].region}`);
                    if(rev[0].street && !street) setStreet(rev[0].street);
                    if(rev[0].postalCode && !pincode) setPincode(rev[0].postalCode);
                 }
              }} style={[styles.permBtn, { marginBottom: 16 }]}>
                <Ionicons name="locate" size={20} color={ACTIVE_ORANGE} />
                <Text style={styles.permText}>{cityState ? `City: ${cityState} ✅` : "Auto-fill using GPS"}</Text>
              </TouchableOpacity>

              <TextInput value={apartment} onChangeText={setApartment} placeholder="Flat / House No. / Floor / Building" style={styles.input} />
              <TextInput value={street} onChangeText={setStreet} placeholder="Street Address / Area" style={styles.input} />
              <TextInput value={pincode} onChangeText={setPincode} keyboardType="number-pad" placeholder="Pincode" style={styles.input} />

              <View style={styles.editActionRow}>
                <TouchableOpacity onPress={() => setAddressFormVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveAddress} style={[styles.saveBtn, { backgroundColor: ACTIVE_ORANGE, flex: 1, alignItems: 'center' }]}>
                  <Text style={styles.saveText}>Save Address</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {addresses.length === 0 ? (
                  <View style={{ alignItems: "center", marginTop: 40 }}>
                    <Ionicons name="location-outline" size={48} color="#C0CDB8" />
                    <Text style={{ marginTop: 12, color: "#8A998A" }}>No addresses saved yet.</Text>
                  </View>
                ) : (
                  addresses.map((addr) => (
                    <View key={addr.id} style={styles.addressCard}>
                      <View style={styles.addressCardIcon}>
                        <Ionicons name={addr.label === "Home" ? "home" : addr.label === "Work" ? "briefcase" : "location"} size={20} color="#4A6038" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addressCardLabel}>{addr.label}</Text>
                        <Text style={styles.addressCardText}>{addr.apartment ? `${addr.apartment}, ` : ""}{addr.street}</Text>
                        <Text style={styles.addressCardText}>{addr.city_state} - {addr.pincode}</Text>
                      </View>
                      <View style={styles.addressCardActions}>
                        <TouchableOpacity onPress={() => openAddressForm(addr)} style={{ padding: 8 }}>
                          <Ionicons name="create-outline" size={20} color="#4A6038" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteAddress(addr.id)} style={{ padding: 8 }}>
                          <Ionicons name="trash-outline" size={20} color="#C0392B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity onPress={() => openAddressForm()} style={[styles.mainBtn, { backgroundColor: ACTIVE_ORANGE }]}>
                <Text style={styles.mainBtnText}>Add New Address</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Order Details Modal */}
      <Modal 
        visible={showOrderDetailModal} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrderDetailModal(false)}
      >
        <View style={styles.orderModalContainer}>
          <View style={styles.orderModalHeader}>
            <Text style={styles.orderModalTitle}>Order Details</Text>
            <TouchableOpacity onPress={() => setShowOrderDetailModal(false)}>
              <Ionicons name="close-circle" size={28} color="#8A998A" />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Store Section */}
              <View style={styles.orderDetailCard}>
                <Image source={{ uri: selectedOrder.stores?.image_url }} style={styles.orderDetailStoreImg} />
                <View style={styles.orderDetailStoreInfo}>
                  <Text style={styles.orderDetailStoreName}>{selectedOrder.stores?.name}</Text>
                  <Text style={styles.orderDetailStoreLoc}>{selectedOrder.stores?.location}</Text>
                </View>
              </View>

              {/* Owner Contact */}
              <View style={styles.contactCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Store Owner</Text>
                  <Text style={styles.contactName}>{getOwnerProfile(selectedOrder)?.full_name || "Owner"}</Text>
                  <Text style={styles.contactPhone}>{getOwnerProfile(selectedOrder)?.phone_number || "No phone provided"}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.callBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const owner = getOwnerProfile(selectedOrder);
                    if (owner?.phone_number) {
                      Linking.openURL(`tel:${owner.phone_number}`);
                    } else {
                      showModernAlert({ title: "Unavailable", message: "No phone number provided", type: "error" });
                    }
                  }}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Items Manifest */}
              <View style={styles.manifestSection}>
                <Text style={styles.manifestTitle}>Harvest Items</Text>
                {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
                  <View key={idx} style={styles.manifestItem}>
                    <Text style={styles.manifestItemQty}>{item.quantity}x</Text>
                    <Text style={styles.manifestItemName}>{item.name || item.title}</Text>
                    <Text style={styles.manifestItemPrice}>₹{item.price * item.quantity}</Text>
                  </View>
                ))}
                <View style={styles.manifestDivider} />
                <View style={styles.manifestTotalRow}>
                  <Text style={styles.manifestTotalLabel}>Total Amount</Text>
                  <Text style={styles.manifestTotalValue}>₹{selectedOrder.total_amount}</Text>
                </View>
              </View>

              {/* Delivery Info */}
              <View style={styles.deliveryDetailCard}>
                <View style={styles.deliveryDetailHeader}>
                  <Ionicons name="location" size={18} color="#FF8C42" />
                  <Text style={styles.deliveryDetailTitle}>Delivery to {selectedOrder.delivery_address?.label}</Text>
                </View>
                <Text style={styles.deliveryDetailAddr}>
                  {selectedOrder.delivery_address?.apartment}, {selectedOrder.delivery_address?.street}, {selectedOrder.delivery_address?.pincode}
                </Text>
              </View>

              <View style={styles.orderStatusCard}>
                 <Text style={styles.statusInfoLabel}>Current Status</Text>
                 <View style={[styles.statusBadgeLarge, selectedOrder.status === 'delivered' ? styles.statusDelivered : styles.statusPending]}>
                    <Text style={[styles.statusTextLarge, selectedOrder.status === 'delivered' ? { color: "#4A6038" } : { color: "#FF8C42" }]}>
                      {selectedOrder.status.toUpperCase()}
                    </Text>
                 </View>
                 <Text style={styles.orderTimestamp}>Placed on {new Date(selectedOrder.created_at).toLocaleString()}</Text>

                 {selectedOrder.status === 'delivered' && (
                   reviewedOrderIds.has(selectedOrder.id) ? (
                     <View style={styles.reviewedBadgeModal}>
                       <Ionicons name="checkmark-circle" size={16} color="#4A6038" style={{ marginRight: 6 }} />
                       <Text style={styles.reviewedBadgeModalText}>You reviewed this order</Text>
                     </View>
                   ) : (
                     <TouchableOpacity
                       style={styles.reviewBtnModal}
                       onPress={() => {
                         setShowOrderDetailModal(false);
                         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                         router.push({
                           pathname: "/(shopper)/leave-review" as any,
                           params: { orderId: selectedOrder.id, storeId: selectedOrder.store_id }
                         });
                       }}
                     >
                       <Ionicons name="star" size={16} color="#fff" style={{ marginRight: 6 }} />
                       <Text style={styles.reviewBtnModalText}>Leave a Review</Text>
                     </TouchableOpacity>
                   )
                 )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6E9" },
  scrollContent: { paddingBottom: 120 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  headerTitle: { fontSize: 28, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", color: "#1E261E", fontWeight: "700" },
  profileCard: { backgroundColor: "#fff", marginHorizontal: 24, borderRadius: 32, padding: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#F4F5E6" },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#fff" },
  userName: { fontSize: 22, fontWeight: "800", color: "#1E261E", marginBottom: 4 },
  infoPill: { backgroundColor: "#F4F5E6", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  infoPillText: { fontSize: 12, color: "#8A998A", fontWeight: "700" },
  editProfileBtn: { marginBottom: 20 },
  statsRow: { flexDirection: "row", width: "100%", borderTopWidth: 1, borderTopColor: "#F5F6E9", paddingTop: 20 },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "800", color: "#1E261E" },
  statLabel: { fontSize: 12, color: "#8A998A" },
  statDivider: { width: 1, height: 30, backgroundColor: "#F5F6E9" },
  editForm: { width: "100%", alignItems: "center" },
  editInput: { width: "100%", backgroundColor: "#F4F5E6", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 16 },
  genderEditRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  genderEditBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F4F5E6" },
  genderEditText: { fontSize: 13, fontWeight: "600", color: "#6B7A6B" },
  editActionRow: { flexDirection: "row", gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelText: { color: "#8A998A", fontWeight: "600" },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  saveText: { color: "#fff", fontWeight: "700" },
  menuSection: { marginTop: 32, paddingHorizontal: 24 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 20, marginBottom: 12 },
  menuIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center", marginRight: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E261E" },
  menuValue: { fontSize: 13, color: "#8A998A", maxWidth: 120 },
  modalContainer: { flex: 1, backgroundColor: "#F5F6E9", padding: 24, paddingTop: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: "800", color: "#1E261E" },
  addressSectionTitle: { fontSize: 18, fontWeight: "700", color: "#1E261E", marginBottom: 16 },
  addressLabelRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  addressLabelBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: "#D0D8C0" },
  addressLabelText: { fontSize: 13, fontWeight: "700", color: "#8A998A" },
  permBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, borderRadius: 20, backgroundColor: "#F4F5E6" },
  permText: { fontWeight: "700", color: "#4A6038" },
  input: { backgroundColor: "#F4F5E6", borderRadius: 16, padding: 16, fontSize: 16, marginBottom: 16 },
  addressCard: { backgroundColor: "#fff", padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  addressCardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center", marginRight: 16 },
  addressCardLabel: { fontSize: 16, fontWeight: "800", color: "#1E261E", marginBottom: 4 },
  addressCardText: { fontSize: 13, color: "#8A998A", marginBottom: 2 },
  addressCardActions: { flexDirection: "row", alignItems: "center" },
  mainBtn: { paddingVertical: 18, borderRadius: 20, alignItems: "center", marginTop: "auto" },
  mainBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  historySection: { padding: 24, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1E261E", marginBottom: 16 },
  orderCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  orderHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  storeThumbBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F5F6E9", overflow: "hidden" },
  storeThumb: { width: "100%", height: "100%" },
  orderStoreName: { fontSize: 15, fontWeight: "800", color: "#1E261E" },
  orderDate: { fontSize: 12, color: "#8A998A", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPending: { backgroundColor: "#FFF2EA" },
  statusDelivered: { backgroundColor: "#E8F5E9" },
  statusText: { fontSize: 10, fontWeight: "800" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F5F6E9" },
  orderItemSummary: { fontSize: 13, color: "#4A524A", fontWeight: "600" },
  reorderBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#F5F6E9" },
  reorderText: { fontSize: 12, fontWeight: "700", color: "#4A6038" },
  emptyHistory: { alignItems: "center", paddingVertical: 40, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 24, borderStyle: "dashed", borderWidth: 1, borderColor: "#D0D8C0" },
  emptyText: { marginTop: 12, color: "#8A998A", fontWeight: "600" },
  orderModalContainer: { flex: 1, backgroundColor: "#F5F6E9", padding: 24, paddingTop: Platform.OS === 'ios' ? 40 : 24 },
  orderModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  orderModalTitle: { fontSize: 24, fontWeight: "800", color: "#1E261E" },
  orderDetailCard: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", marginBottom: 16 },
  orderDetailStoreImg: { width: "100%", height: 160 },
  orderDetailStoreInfo: { padding: 20 },
  orderDetailStoreName: { fontSize: 20, fontWeight: "900", color: "#1E261E" },
  orderDetailStoreLoc: { fontSize: 14, color: "#8A998A", marginTop: 4 },
  contactCard: { backgroundColor: "#1E261E", borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  contactLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "600", marginBottom: 4 },
  contactName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  contactPhone: { fontSize: 14, color: "#FF8C42", fontWeight: "600", marginTop: 2 },
  callBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#4A6038", justifyContent: "center", alignItems: "center" },
  manifestSection: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16 },
  manifestTitle: { fontSize: 16, fontWeight: "800", color: "#1E261E", marginBottom: 16 },
  manifestItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  manifestItemQty: { fontSize: 14, fontWeight: "800", color: "#4A6038", width: 30 },
  manifestItemName: { fontSize: 14, color: "#1E261E", flex: 1 },
  manifestItemPrice: { fontSize: 14, fontWeight: "700", color: "#1E261E" },
  manifestDivider: { height: 1, backgroundColor: "#F5F6E9", marginVertical: 12 },
  manifestTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  manifestTotalLabel: { fontSize: 16, fontWeight: "800", color: "#1E261E" },
  manifestTotalValue: { fontSize: 18, fontWeight: "900", color: "#FF8C42" },
  deliveryDetailCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16 },
  deliveryDetailHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  deliveryDetailTitle: { fontSize: 15, fontWeight: "800", color: "#1E261E" },
  deliveryDetailAddr: { fontSize: 14, color: "#6B7A6B", lineHeight: 20 },
  orderStatusCard: { alignItems: "center", paddingVertical: 20 },
  statusInfoLabel: { fontSize: 12, color: "#8A998A", fontWeight: "700", marginBottom: 8 },
  statusBadgeLarge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, marginBottom: 12 },
  statusTextLarge: { fontSize: 14, fontWeight: "900" },
  orderTimestamp: { fontSize: 12, color: "#8A998A" },
  reviewedInlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewedInlineText: {
    color: "#4A6038",
    fontSize: 12,
    fontWeight: "700",
  },
  reviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FF8C42",
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  reviewedBadgeModal: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
  },
  reviewedBadgeModalText: {
    color: "#4A6038",
    fontSize: 14,
    fontWeight: "700",
  },
  reviewBtnModal: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8C42",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
  },
  reviewBtnModalText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
