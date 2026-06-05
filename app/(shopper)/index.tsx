import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, { 
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { supabase } from "../../lib/supabase";
import * as Haptics from "expo-haptics";
import { NotificationService } from "../../lib/notificationService";

export default function HomeScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [closedStoreModal, setClosedStoreModal] = useState({ show: false, name: '' });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const categories = [
    "Dairy Products", "Fruits", "Grains", "Herbs & Spices", "Leafy Greens",
    "Oils", "Organic Snacks", "Other Organic Products", "Pulses", "Vegetables"
  ];

  const lastScrollY = useSharedValue(0);
  const isTabBarVisible = useSharedValue(1);

  const toggleTabBarJS = (visible: number) => {
    DeviceEventEmitter.emit('TOGGLE_TAB_BAR', visible);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      if (currentY <= 0) {
        if (isTabBarVisible.value !== 1) {
          isTabBarVisible.value = 1;
          runOnJS(toggleTabBarJS)(1);
        }
      } else if (currentY > lastScrollY.value + 10 && currentY > 50) {
        if (isTabBarVisible.value !== 0) {
          isTabBarVisible.value = 0;
          runOnJS(toggleTabBarJS)(0);
        }
      } else if (currentY < lastScrollY.value - 20) {
        if (isTabBarVisible.value !== 1) {
          isTabBarVisible.value = 1;
          runOnJS(toggleTabBarJS)(1);
        }
      }
      lastScrollY.value = currentY;
    },
  });

  const fetchProfile = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await NotificationService.fetchNotifications(user.id, "customer");
        const unread = data.filter(n => !n.is_read).length;
        setUnreadNotifCount(unread);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, []);

  const fetchStores = React.useCallback(async () => {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setStores(data);
  }, []);

  const fetchAllProducts = React.useCallback(async () => {
    const { data } = await supabase.from("products").select("*");
    if (data) setAllProducts(data);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchUnreadCount();
    }, [fetchProfile, fetchUnreadCount])
  );

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        unsubscribe = NotificationService.subscribeToNotifications(
          user.id,
          "customer",
          () => {
            setUnreadNotifCount(prev => prev + 1);
          }
        );
      }
    };

    setupRealtime();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchStores();
    fetchAllProducts();
  }, [fetchStores, fetchAllProducts]);

  const toggleFollow = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowing(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const placeholderImg = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800";

  const searchResults = React.useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    
    const filtered = allProducts.filter(p => 
      p.name?.toLowerCase().includes(query) || 
      p.category?.toLowerCase().includes(query)
    );
    
    const grouped = filtered.reduce((acc: any, curr: any) => {
      const key = curr.name.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = {
          name: curr.name,
          category: curr.category,
          image_url: curr.image_url,
          storeIds: new Set([curr.store_id]),
        };
      } else {
        acc[key].storeIds.add(curr.store_id);
        if (!acc[key].image_url && curr.image_url) {
          acc[key].image_url = curr.image_url;
        }
      }
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped).map((g: any) => ({
      ...g,
      storeCount: g.storeIds.size,
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [searchQuery, allProducts]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.appNameContainer}>
              <FontAwesome5 name="seedling" size={16} color="#4A6038" />
              <Text style={styles.headerTitle}>Organica Bucket</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(shopper)/notifications" as any);
                }}
                style={styles.bellBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={22} color="#4A6038" />
                {unreadNotifCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => router.push("/(shopper)/profile" as any)}
                style={styles.profileBtn}
              >
                <Image
                  source={{ uri: userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.full_name || 'User'}` }}
                  style={styles.profileAvatar}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.greetingSection}>
            <View style={styles.greetingRow}>
              <Text style={styles.namasteText}>Namaste,</Text>
              <Text style={styles.userNameText}>{userProfile?.full_name?.split(" ")[0] || "User"}</Text>
            </View>
            
            {userProfile?.location_data && (Array.isArray(userProfile.location_data) ? userProfile.location_data.length > 0 : true) && (
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={14} color="#FF8C42" />
                <Text style={styles.headerLocationText}>
                  {Array.isArray(userProfile.location_data) 
                    ? userProfile.location_data[0]?.city_state || "Unknown Location"
                    : userProfile.location_data.city_state || "Unknown Location"}
                </Text>
              </View>
            )}
            
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.searchBarContainer, { flex: 1 }]}>
                <Ionicons name="search" size={20} color="#8A998A" />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search products and local stores..."
                  placeholderTextColor="#8A998A"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                    <Ionicons name="close-circle" size={20} color="#8A998A" />
                  </TouchableOpacity>
                )}
              </View>
              {isSearchFocused && (
                <TouchableOpacity onPress={() => {
                  setIsSearchFocused(false);
                  setSearchQuery("");
                  searchInputRef.current?.blur();
                }} style={{ padding: 4 }}>
                  <Text style={{ color: "#4A6038", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {isSearchFocused && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.categorySection}>
                <Text style={styles.categoryHeaderTitle}>Explore Categories</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                  contentContainerStyle={styles.categoryScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {categories.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.categoryPill}
                      onPress={() => {
                        // Keep search open or close it? The user navigates away, so it doesn't matter too much,
                        // but closing it is cleaner when they come back
                        setIsSearchFocused(false);
                        router.push(`/(shopper)/category/${encodeURIComponent(cat)}` as any);
                      }}
                    >
                      <Text style={styles.categoryPillText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {isSearchFocused && searchQuery.length > 0 ? (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.sectionTitle}>Products</Text>
            {searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="basket-outline" size={48} color="#C4CEC4" />
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySub}>We couldn&apos;t find any products matching &quot;{searchQuery}&quot;. Try browsing categories above.</Text>
              </View>
            ) : (
              <View style={styles.productResultsList}>
                {searchResults.map((item, index) => (
                  <Animated.View key={index} entering={FadeInUp.delay(index * 50)}>
                    <TouchableOpacity 
                      style={styles.productResultCard}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/(shopper)/product/${encodeURIComponent(item.name)}` as any)}
                    >
                      <Image source={{ uri: item.image_url || placeholderImg }} style={styles.productResultImage} contentFit="cover" />
                      <View style={styles.productResultInfo}>
                        <Text style={styles.productResultName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.productResultCategory}>{item.category}</Text>
                        <View style={styles.storeCountPill}>
                          <Ionicons name="storefront-outline" size={14} color="#4A6038" />
                          <Text style={styles.storeCountText}>{item.storeCount} {item.storeCount === 1 ? 'store' : 'stores'}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#C4CEC4" />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Local Organic Stores</Text>
                <View style={styles.titleUnderline} />
              </View>
              <TouchableOpacity style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="arrow-forward" size={14} color="#FF8C42" />
              </TouchableOpacity>
            </View>

            <View style={styles.storesList}>
              {(() => {
                const filteredStores = stores;

                if (filteredStores.length === 0) {
                  return (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="storefront-outline" size={48} color="#C4CEC4" />
                      <Text style={styles.emptyTitle}>No Stores Found</Text>
                      <Text style={styles.emptySub}>There are no local stores available right now.</Text>
                    </View>
                  );
                }

                return filteredStores.map((store, index) => {
              const isFollowing = following.includes(store.id);
              const isLive = store.is_accepting_orders;
              
              return (
                <TouchableOpacity 
                  key={store.id} 
                  activeOpacity={0.9}
                  onPress={() => {
                    if (isLive) {
                      router.push(`/shop/${store.id}`);
                    } else {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      setClosedStoreModal({ show: true, name: store.name });
                    }
                  }}
                >
                  <Animated.View entering={FadeInUp.delay(index * 100)} style={styles.premiumCard}>
                    {/* Image Section - Top 60% */}
                    <View style={styles.cardImageContainer}>
                      <Image source={{ uri: store.image_url || placeholderImg }} style={styles.cardImage} contentFit="cover" />
                      
                      {/* Top Badges overlay */}
                      <View style={styles.imageBadgeRow}>
                        <BlurView intensity={80} tint={isLive ? "light" : "dark"} style={[styles.statusBadge, isLive ? { backgroundColor: "rgba(39, 174, 96, 0.85)" } : null]}>
                          <Text style={[styles.statusBadgeText, isLive ? { color: "#fff" } : null]}>
                            {isLive ? "LIVE HARVEST" : "CLOSED"}
                          </Text>
                        </BlurView>
                        
                        <TouchableOpacity 
                          onPress={() => toggleFollow(store.id)} 
                          style={[styles.followBtn, isFollowing ? styles.followingBtn : null]}
                        >
                          <Ionicons 
                            name={isFollowing ? "checkmark-circle" : "person-add-outline"} 
                            size={14} 
                            color={isFollowing ? "#fff" : "#1E261E"} 
                          />
                          <Text style={[styles.followBtnText, isFollowing ? styles.followingBtnText : null]}>
                            {isFollowing ? "Following" : "Follow"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Content Section - Bottom 40% */}
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeaderRow}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                          <View style={styles.locationRow}>
                            <Ionicons name="location-sharp" size={14} color="#FF8C42" />
                            <Text style={styles.locationText} numberOfLines={1}>{store.address || store.location || "Nearby Local Farm"}</Text>
                          </View>
                        </View>
                        <View style={styles.ratingBox}>
                          <Ionicons name="star" size={12} color="#F1C40F" />
                          <Text style={styles.ratingText}>4.9</Text>
                        </View>
                      </View>
                      
                      {/* Dynamic Data Row (Status) */}
                      <View style={styles.dynamicDataRow}>
                        <View style={styles.dataPill}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#4A6038" />
                          <Text style={styles.dataPillText} numberOfLines={1}>
                            {store.status_message || (isLive ? "Accepting orders now" : "Preparing harvest")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
        </>
        )}
      </Animated.ScrollView>

      {/* Closed Store Modal */}
      <Modal transparent visible={closedStoreModal.show} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp} style={styles.closedModalCard}>
            <View style={styles.closedIconContainer}>
              <MaterialCommunityIcons name="store-off-outline" size={40} color="#FF8C42" />
            </View>
            <Text style={styles.closedModalTitle}>{closedStoreModal.name} is Offline</Text>
            <Text style={styles.closedModalSub}>
              This store is currently not accepting any orders. Please check back later or explore other live harvests!
            </Text>
            <TouchableOpacity 
              onPress={() => setClosedStoreModal({ show: false, name: '' })}
              style={styles.closedModalBtn}
            >
              <Text style={styles.closedModalBtnText}>Okay, Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6E9" },
  scrollContent: { paddingBottom: 140 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F6E9" },
  header: { paddingHorizontal: 24, paddingTop: 10, marginBottom: 20 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 30 },
  appNameContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#4A6038", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", fontStyle: "italic" },
  profileBtn: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
  profileAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff" },
  greetingSection: { marginTop: 0 },
  greetingRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 },
  namasteText: { fontSize: 24, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", color: "#1E261E" },
  userNameText: { fontSize: 24, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", color: "#4A6038", fontStyle: "italic" },
  locationContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  headerLocationText: { fontSize: 13, color: "#FF8C42", fontWeight: "700" },
  
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#4A6038",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E0E8D8",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1E261E",
    fontWeight: "500",
  },
  clearSearchBtn: {
    padding: 4,
  },

  categorySection: {
    marginTop: 20,
  },
  categoryHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4A6038",
    marginBottom: 10,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  categoryScroll: {
    maxHeight: 44,
  },
  categoryScrollContent: {
    gap: 10,
    paddingRight: 20, // Add padding at the end for smooth scroll cutoff
  },
  categoryPill: {
    backgroundColor: "#F4F5E6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E8D8",
  },
  categoryPillText: {
    fontSize: 13,
    color: "#4A6038",
    fontWeight: "700",
  },

  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1E261E", marginTop: 12, marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#8A998A", textAlign: "center", paddingHorizontal: 20 },

  searchResultsContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  productResultsList: { gap: 16, marginTop: 16 },
  productResultCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, padding: 12, shadowColor: "#4A6038", shadowOpacity: 0.06, shadowRadius: 15, elevation: 4 },
  productResultImage: { width: 80, height: 80, borderRadius: 16, backgroundColor: "#F4F5E6" },
  productResultInfo: { flex: 1, marginLeft: 16, justifyContent: "center" },
  productResultName: { fontSize: 16, fontWeight: "800", color: "#1E261E", marginBottom: 4 },
  productResultCategory: { fontSize: 12, color: "#8A998A", fontWeight: "600", marginBottom: 8 },
  storeCountPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F4F5E6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start" },
  storeCountText: { fontSize: 12, fontWeight: "700", color: "#4A6038" },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 22, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", color: "#1E261E", fontWeight: "700" },
  titleUnderline: { height: 3, width: 30, backgroundColor: "#FF8C42", marginTop: 4 },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewAllText: { fontSize: 14, color: "#FF8C42", fontWeight: "700" },
  storesList: { paddingHorizontal: 20, gap: 24 },
  premiumCard: { width: "100%", height: 380, borderRadius: 32, overflow: "hidden", backgroundColor: "#fff", shadowColor: "#4A6038", shadowOpacity: 0.12, shadowRadius: 30, elevation: 12 },
  cardImageContainer: { width: "100%", height: "60%", backgroundColor: "#E0E8D8" },
  cardImage: { width: "100%", height: "100%" },
  imageBadgeRow: { position: "absolute", top: 16, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  statusBadgeText: { fontSize: 11, fontWeight: "900", color: "#1E261E", letterSpacing: 0.8 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  followingBtn: { backgroundColor: "#FF8C42", borderColor: "#FF8C42" },
  followBtnText: { color: "#1E261E", fontSize: 12, fontWeight: "800" },
  followingBtnText: { color: "#fff" },
  
  cardContent: { padding: 20, height: "40%", justifyContent: "space-between" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  storeName: { fontSize: 24, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", color: "#1E261E", fontWeight: "800", marginBottom: 6 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13, color: "#6B7A6B", fontWeight: "600" },
  ratingBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF9E6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ratingText: { fontSize: 13, fontWeight: "800", color: "#F39C12" },
  
  dynamicDataRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 16 },
  dataPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F5E6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, maxWidth: "100%" },
  dataPillText: { fontSize: 13, fontWeight: "700", color: "#4A6038", flexShrink: 1 },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  closedModalCard: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  closedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF2EA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  closedModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E261E",
    marginBottom: 12,
    textAlign: "center",
  },
  closedModalSub: {
    fontSize: 15,
    color: "#8A998A",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  closedModalBtn: {
    backgroundColor: "#4A6038",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  closedModalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#4A6038",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E0E8D8",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF8C42",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#F5F6E9",
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
});
