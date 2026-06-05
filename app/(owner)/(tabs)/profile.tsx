import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, TextInput } from "react-native";
import { showModernAlert } from "../../../components/ModernAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";
import { supabase } from "../../../lib/supabase";
import * as Haptics from "expo-haptics";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { useRouter } from "expo-router";

const SOFT_GREEN = "#4A6038";

export default function OwnerProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreDesc, setEditStoreDesc] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editStoreCategory, setEditStoreCategory] = useState("");
  const [editStoreLocation, setEditStoreLocation] = useState("");
  const [editStoreAddress, setEditStoreAddress] = useState("");
  const [editStatusMessage, setEditStatusMessage] = useState("");
  const [editNextDelivery, setEditNextDelivery] = useState("");
  const [newStoreImage, setNewStoreImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profileData }, { data: storeData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("stores").select("*").eq("owner_id", user.id).single(),
      ]);

      setProfile(profileData);
      setStore(storeData);
      setEditStoreName(storeData?.name || "");
      setEditStoreDesc(storeData?.description || "");
      setEditOwnerName(profileData?.full_name || "");
      setEditStoreCategory(storeData?.category || "Organic");
      setEditStoreLocation(storeData?.location || "");
      setEditStoreAddress(storeData?.address || "");
      setEditStatusMessage(storeData?.status_message || "");
      setEditNextDelivery(storeData?.next_delivery_date || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pickStoreImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setNewStoreImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);
      
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('stores').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('stores').getPublicUrl(data.path);
      return publicUrl;
    } catch (err: any) {

      showModernAlert({ title: "Upload Failed", message: err.message || "Failed to upload store image.", type: "error" });
      return null;
    }
  };

  const handleSaveStore = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let imageUrl = store.image_url;
    if (newStoreImage) {
      const uploadedUrl = await uploadImage(newStoreImage);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update Store
    const { error: storeError } = await supabase
      .from("stores")
      .update({ 
        name: editStoreName, 
        description: editStoreDesc, 
        category: editStoreCategory, 
        location: editStoreLocation, 
        image_url: imageUrl,
        status_message: editStatusMessage,
        next_delivery_date: editNextDelivery || null,
        address: editStoreAddress
      })
      .eq("id", store.id);

    // Update Profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: editOwnerName })
      .eq("id", user.id);

    if (!storeError && !profileError) {
      setStore({ 
        ...store, 
        name: editStoreName, 
        description: editStoreDesc, 
        category: editStoreCategory, 
        location: editStoreLocation, 
        image_url: imageUrl,
        status_message: editStatusMessage,
        next_delivery_date: editNextDelivery || null,
        address: editStoreAddress
      });
      setProfile({ ...profile, full_name: editOwnerName });
      setIsEditing(false);
      showModernAlert({ title: "Saved", message: "Store and Profile details updated!", type: "success" });
    } else {
      showModernAlert({ title: "Error", message: storeError?.message || profileError?.message || "Something went wrong", type: "error" });
    }
    setSaving(false);
  };

  const handleSignOut = () => {
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

  const toggleOrdering = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newStatus = !store.is_accepting_orders;
    const { error } = await supabase
      .from("stores").update({ is_accepting_orders: newStatus }).eq("id", store.id);
    if (!error) setStore({ ...store, is_accepting_orders: newStatus });
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={SOFT_GREEN} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.headerRow}>
          <Text style={styles.title}>Store Profile</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#C0392B" />
          </TouchableOpacity>
        </Animated.View>

        {/* Store Banner Card */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.bannerCard}>
          <Image
            source={{ uri: newStoreImage || store?.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800" }}
            style={styles.bannerImage}
            contentFit="cover"
          />
          {isEditing && (
            <TouchableOpacity onPress={pickStoreImage} style={styles.imageEditBadge}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.imageEditText}>Change Cover</Text>
            </TouchableOpacity>
          )}
          <View style={styles.bannerOverlay}>
            <View style={styles.categoryBadge}>
              <MaterialCommunityIcons name="leaf" size={12} color="#fff" />
              <Text style={styles.categoryText}>{store?.category || "Organic"}</Text>
            </View>
          </View>
          <View style={styles.bannerInfo}>
            <View style={styles.ownerAvatarWrapper}>
              <Image
                source={{ uri: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/png?seed=${profile?.full_name}` }}
                style={styles.ownerAvatar}
              />
            </View>
            <View style={{ flex: 1 }}>
              {isEditing ? (
                <TextInput
                  value={editStoreName}
                  onChangeText={setEditStoreName}
                  style={styles.editInput}
                  placeholder="Store Name"
                />
              ) : (
                <Text style={styles.storeNameText}>{store?.name || "My Organic Store"}</Text>
              )}
              <Text style={styles.ownerNameText}>by {profile?.full_name}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editBtn}>
              <Ionicons name={isEditing ? "close" : "create-outline"} size={18} color={SOFT_GREEN} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bio */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.card}>
          <Text style={styles.cardTitle}>Store Bio</Text>
          {isEditing ? (
            <TextInput
              value={editStoreDesc}
              onChangeText={setEditStoreDesc}
              multiline
              placeholder="Tell customers about your farm..."
              style={[styles.editInput, { height: 80, textAlignVertical: "top" }]}
            />
          ) : (
            <Text style={styles.bioText}>{store?.description || "No bio yet. Tell your organic story!"}</Text>
          )}
          {isEditing && (
            <TouchableOpacity onPress={handleSaveStore} disabled={saving}
              style={[styles.saveBtn, { backgroundColor: SOFT_GREEN }]}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Store Details */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.card}>
          <Text style={styles.cardTitle}>{isEditing ? "Edit Details" : "Store Details"}</Text>
          {isEditing ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <Text style={styles.detailLabel}>Owner Name</Text>
              <TextInput value={editOwnerName} onChangeText={setEditOwnerName} style={styles.editInput} placeholder="Your Full Name" />
              <Text style={styles.detailLabel}>Store Category</Text>
              <TextInput value={editStoreCategory} onChangeText={setEditStoreCategory} style={styles.editInput} placeholder="e.g. Organic Fruits" />
              <Text style={styles.detailLabel}>Location (City, State)</Text>
              <TextInput value={editStoreLocation} onChangeText={setEditStoreLocation} style={styles.editInput} placeholder="e.g. Jayanagar, Bangalore" />
              
              <Text style={styles.detailLabel}>Full Shop Address</Text>
              <TextInput 
                value={editStoreAddress} 
                onChangeText={setEditStoreAddress} 
                style={[styles.editInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} 
                placeholder="Building, Street, Landmark..." 
                multiline
                numberOfLines={3}
              />
              
              <Text style={styles.detailLabel}>Live Status Message</Text>
              <TextInput 
                value={editStatusMessage} 
                onChangeText={setEditStatusMessage} 
                style={styles.editInput} 
                placeholder="e.g. Harvesting fresh mangoes!" 
              />
              
              <Text style={styles.detailLabel}>Next Delivery (YYYY-MM-DD)</Text>
              <TextInput 
                value={editNextDelivery} 
                onChangeText={setEditNextDelivery} 
                style={styles.editInput} 
                placeholder="2026-11-25" 
              />
              <View style={styles.dateChipsContainer}>
                {[
                  { label: "Today", days: 0 },
                  { label: "Tomorrow", days: 1 },
                  { label: "+3 Days", days: 3 }
                ].map((chip) => (
                  <TouchableOpacity 
                    key={chip.label}
                    style={styles.dateChip}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + chip.days);
                      setEditNextDelivery(d.toISOString().split('T')[0]);
                    }}
                  >
                    <Text style={styles.dateChipText}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: 14, marginTop: 12 }}>
              {[
                { icon: "person-outline", label: "Owner", value: profile?.full_name || "Not set" },
                { icon: "location-outline", label: "Location", value: store?.location || "Not set" },
                { icon: "leaf-outline", label: "Category", value: store?.category || "Not set" },
                { icon: "call-outline", label: "Phone", value: profile?.phone_number || "Not set" },
                { icon: "megaphone-outline", label: "Status", value: store?.status_message || "No active message" },
                { icon: "calendar-outline", label: "Delivery", value: store?.next_delivery_date || "Not scheduled" },
                { icon: "map-outline", label: "Address", value: store?.address || "Not set" },
              ].map((item, i) => (
                <View key={i} style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name={item.icon as any} size={18} color={SOFT_GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Store Reviews Link */}
        {!isEditing && (
          <Animated.View entering={FadeInUp.delay(350)}>
            <TouchableOpacity
              style={styles.reviewsLinkCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(owner)/reviews" as any);
              }}
            >
              <View style={styles.reviewsLinkIcon}>
                <Ionicons name="star" size={20} color="#F1C40F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewsLinkTitle}>Store Reviews</Text>
                <Text style={styles.reviewsLinkSub}>
                  {store?.average_rating ? Number(store.average_rating).toFixed(1) : "0.0"} average ({store?.total_reviews || 0} reviews)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={SOFT_GREEN} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Order Toggle */}
        <Animated.View entering={FadeInUp.delay(400)} style={[styles.toggleCard, { backgroundColor: store?.is_accepting_orders ? "#27AE60" : "#2D382D" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>
              {store?.is_accepting_orders ? "🟢 Accepting Orders" : "🔴 Orders Closed"}
            </Text>
            <Text style={styles.toggleSub}>
              {store?.is_accepting_orders ? "Customers can order right now." : "Tap to go live."}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleOrdering} style={styles.toggleBtn}>
            <Text style={styles.toggleBtnText}>{store?.is_accepting_orders ? "Close" : "Go Live"}</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6E9" },
  scroll: { padding: 24, paddingBottom: 24 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "800", color: "#1E261E", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  signOutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  bannerCard: { backgroundColor: "#fff", borderRadius: 28, overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 20, elevation: 4 },
  bannerImage: { width: "100%", height: 160 },
  imageEditBadge: { position: "absolute", top: '50%', left: '50%', transform: [{translateX: -60}, {translateY: -20}], flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  imageEditText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  bannerOverlay: { position: "absolute", top: 12, left: 12 },
  categoryBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(74,96,56,0.85)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  categoryText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bannerInfo: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  ownerAvatarWrapper: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: "#F5F6E9", overflow: "hidden" },
  ownerAvatar: { width: "100%", height: "100%" },
  storeNameText: { fontSize: 18, fontWeight: "800", color: "#1E261E" },
  ownerNameText: { fontSize: 13, color: "#8A998A", marginTop: 2 },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center" },
  editInput: { backgroundColor: "#F4F5E6", borderRadius: 12, padding: 12, fontSize: 15, marginTop: 8 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#1E261E" },
  bioText: { fontSize: 14, color: "#6B7A6B", lineHeight: 22, marginTop: 10 },
  saveBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F4F5E6", justifyContent: "center", alignItems: "center" },
  detailLabel: { fontSize: 11, color: "#8A998A", fontWeight: "700" },
  detailValue: { fontSize: 14, color: "#1E261E", fontWeight: "600" },
  toggleCard: { borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 16 },
  toggleTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 4 },
  toggleSub: { fontSize: 12, color: "rgba(255,255,255,0.65)" },
  toggleBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  toggleBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  dateChipsContainer: { flexDirection: "row", gap: 8, marginTop: 4 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#EAF0E4", borderWidth: 1, borderColor: "rgba(74,96,56,0.2)" },
  dateChipText: { fontSize: 12, color: "#4A6038", fontWeight: "600" },
  reviewsLinkCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(240, 242, 217, 0.5)",
  },
  reviewsLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FDF9E6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reviewsLinkTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E261E",
  },
  reviewsLinkSub: {
    fontSize: 12,
    color: "#8A998A",
    fontWeight: "600",
    marginTop: 2,
  },
});
