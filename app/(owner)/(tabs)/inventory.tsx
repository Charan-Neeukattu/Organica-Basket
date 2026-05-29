import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";
import { showModernAlert } from "../../../components/ModernAlert";
import { supabase } from "../../../lib/supabase";

const SOFT_GREEN = "#4A6038";
const BG = "#F5F6E9";

export default function InventoryScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    id: "",
    name: "",
  });
  const params = useLocalSearchParams();

  // Dynamically extract categories from products
  const dynamicCategories = [
    "All",
    ...new Set(products.map((p) => p.category)),
  ];

  useFocusEffect(
    React.useCallback(() => {
      fetchProducts();
      if (params.category) {
        setSelectedCategory(params.category as string);
        router.setParams({ category: "" });
      }
    }, [params.category]),
  );

  const fetchProducts = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storeData } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (storeData) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeData.id)
          .order("created_at", { ascending: false });

        setProducts(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBulkUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const fileUri = result.assets[0].uri;
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64" as any,
      });

      const workbook = XLSX.read(fileBase64, { type: "base64" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        showModernAlert({
          title: "Empty File",
          message: "No data found in the selected sheet.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: storeData } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (!storeData) throw new Error("Store not found");

      // Map and validate data
      const productsToInsert = jsonData
        .map((row: any) => ({
          store_id: storeData.id,
          name:
            row.name || row.Name || row["Product Name"] || "Unnamed Product",
          price: parseFloat(row.price || row.Price || 0),
          unit: row.unit || row.Unit || "kg",
          category: row.category || row.Category || "Veggies",
          description: row.description || row.Description || "",
          image_url: row.image_url || row.Image || row["Image URL"] || null,
          is_available: true,
        }))
        .filter((p) => p.price > 0 && p.name !== "Unnamed Product");

      if (productsToInsert.length === 0) {
        showModernAlert({
          title: "Invalid Data",
          message:
            "Could not find valid products. Ensure columns are: name, price, unit, category.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("products")
        .insert(productsToInsert);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showModernAlert({
        title: "Success",
        message: `Successfully imported ${productsToInsert.length} products!`,
        type: "success",
      });
      fetchProducts();
    } catch (err: any) {
      showModernAlert({
        title: "Import Failed",
        message: err.message,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatus = !currentStatus;

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_available: newStatus } : p)),
    );

    const { error } = await supabase
      .from("products")
      .update({ is_available: newStatus })
      .eq("id", id);

    if (error) {
      showModernAlert({
        title: "Error",
        message: "Could not update availability",
        type: "error",
      });
      fetchProducts(); // Rollback
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const uploadAndAttachImage = async (productId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;

      showModernAlert({
        title: "Add Photo",
        message: "Choose a source",
        type: "info",
        buttons: [
          { text: "Camera", onPress: () => capturePhoto(productId) },
          { text: "Gallery", onPress: () => pickFromGallery(productId) },
          { text: "Cancel", onPress: () => {}, style: "cancel" },
        ],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const pickFromGallery = async (id: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) processImageUpdate(id, result.assets[0].uri);
  };

  const capturePhoto = async (id: string) => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) processImageUpdate(id, result.assets[0].uri);
  };

  const processImageUpdate = async (id: string, uri: string) => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(uri);
      const blob = await response.blob();
      const path = `${user.id}/quick_${Date.now()}.jpg`;

      const { data, error: upError } = await supabase.storage
        .from("products")
        .upload(path, blob);
      if (upError) throw upError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(data.path);

      const { error: dbError } = await supabase
        .from("products")
        .update({ image_url: publicUrl })
        .eq("id", id);
      if (dbError) throw dbError;

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, image_url: publicUrl } : p)),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      showModernAlert({
        title: "Update Failed",
        message: err.message,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const deleteProduct = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteModal({ show: true, id, name });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
    setDeleteModal((prev) => ({ ...prev, show: false }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const renderProduct = ({ item, index }: { item: any; index: number }) => {
    const isGrid = viewMode === "grid";

    return (
      <Animated.View
        entering={FadeInRight.delay(index * 50)}
        layout={Layout.springify()}
        style={[styles.productCard, isGrid ? styles.gridCard : styles.listCard]}
      >
        {/* Image Area */}
        <View style={isGrid ? styles.gridImgWrapper : styles.listImgWrapper}>
          <Image
            source={{
              uri:
                item.image_url ||
                "https://images.unsplash.com/photo-1542838132-92c53300491e",
            }}
            style={styles.imageBase}
            contentFit="cover"
          />
          <View style={styles.badgeOverlay}>
            <View
              style={[
                styles.statusPillSmall,
                { backgroundColor: item.is_available ? "#27AE60" : "#7F8C8D" },
              ]}
            />
          </View>
        </View>

        {/* Info Area */}
        <View style={styles.infoContainer}>
          <View style={styles.infoMain}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.productMeta} numberOfLines={1}>
              {item.category} {!isGrid && `· ${item.unit}`}
            </Text>
          </View>

          <View style={styles.infoFooter}>
            <Text style={styles.priceText}>₹{item.price}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(owner)/add-product",
                    params: { id: item.id },
                  })
                }
                style={styles.iconBtn}
              >
                <Ionicons name="create-outline" size={18} color={SOFT_GREEN} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteProduct(item.id, item.name)}
                style={[styles.iconBtn, { backgroundColor: "#FDEDEC" }]}
              >
                <Ionicons name="trash-outline" size={18} color="#C0392B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Delete Confirmation Modal */}
      <Modal transparent visible={deleteModal.show} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut}
            style={styles.modalCard}
          >
            <View style={styles.modalIconBg}>
              <Ionicons name="trash" size={32} color="#C0392B" />
            </View>
            <Text style={styles.modalTitle}>Delete Product?</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to remove{" "}
              <Text style={{ fontWeight: "800", color: "#1E261E" }}>
                &quot;{deleteModal.name}&quot;
              </Text>
              ? This action cannot be undone.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setDeleteModal({ ...deleteModal, show: false })}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteBtnText}>Delete Now</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {products.length} Products in Catalog
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setViewMode((v) => (v === "list" ? "grid" : "list"));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[styles.actionBtnHeader, { backgroundColor: "#fff" }]}
          >
            <Ionicons
              name={viewMode === "list" ? "grid-outline" : "list-outline"}
              size={20}
              color={SOFT_GREEN}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBulkUpload}
            style={[styles.actionBtnHeader, { backgroundColor: "#fff" }]}
          >
            <MaterialCommunityIcons
              name="file-excel-outline"
              size={20}
              color={SOFT_GREEN}
            />
            <Text style={styles.actionBtnTextHeader}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(owner)/add-product")}
            style={[styles.actionBtnHeader, { backgroundColor: SOFT_GREEN }]}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#8A998A" />
          <TextInput
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#B0BDB0"
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#C0CDB8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {dynamicCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                setSelectedCategory(cat);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={SOFT_GREEN} />
        </View>
      ) : (
        <FlatList
          key={viewMode} // Forces re-render when switching columns
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.columnWrapper : null}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchProducts();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={80} color="#C0CDB8" />
              <Text style={styles.emptyTitle}>
                {searchQuery || selectedCategory !== "All"
                  ? "No matches found"
                  : "Your store is empty"}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery || selectedCategory !== "All"
                  ? "Try adjusting your search or category filters"
                  : "Start by adding your first fresh harvest!"}
              </Text>
              {!searchQuery && selectedCategory === "All" && (
                <TouchableOpacity
                  onPress={() => router.push("/(owner)/add-product")}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
    gap: 8,
  },
  headerActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1E261E",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 12, color: "#8A998A", fontWeight: "600" },
  searchSection: { paddingHorizontal: 24, marginBottom: 20 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1E261E",
    fontWeight: "600",
  },
  filterScroll: { paddingRight: 40, gap: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E8D8",
  },
  filterChipActive: { backgroundColor: SOFT_GREEN, borderColor: SOFT_GREEN },
  filterChipText: { fontSize: 13, fontWeight: "700", color: "#6B7A6B" },
  filterChipTextActive: { color: "#fff" },
  actionBtnHeader: {
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  actionBtnTextHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: SOFT_GREEN,
    marginLeft: 6,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: SOFT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: SOFT_GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  columnWrapper: { justifyContent: "space-between", paddingHorizontal: 8 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#4A6038",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  listCard: { flexDirection: "row", padding: 12, alignItems: "center" },
  gridCard: { flexDirection: "column", width: "48%" },

  listImgWrapper: {
    width: 85,
    height: 85,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#F4F5E6",
  },
  gridImgWrapper: { width: "100%", height: 140, backgroundColor: "#F4F5E6" },
  imageBase: { width: "100%", height: "100%" },

  badgeOverlay: { position: "absolute", top: 8, right: 8 },
  statusPillSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  dotSmall: { width: "100%", height: "100%", borderRadius: 6 },

  infoContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: "space-between",
    minHeight: 80,
  },
  infoMain: { gap: 2 },
  productName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E261E",
    letterSpacing: -0.3,
  },
  productMeta: { fontSize: 12, color: "#8A998A", fontWeight: "600" },

  infoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  priceText: { fontSize: 18, fontWeight: "900", color: SOFT_GREEN },

  actionRow: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F4F5E6",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4A6038",
    marginTop: 20,
  },
  emptySub: {
    fontSize: 14,
    color: "#8A998A",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: SOFT_GREEN,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
  },
  modalIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FDEDEC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E261E",
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 15,
    color: "#8A998A",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  modalActionRow: { flexDirection: "row", gap: 12, width: "100%" },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F4F5E6",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#8A998A" },
  confirmDeleteBtn: {
    flex: 2,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#C0392B",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
