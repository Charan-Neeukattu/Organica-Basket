import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { ReviewService } from "../../lib/reviewService";
import { showModernAlert } from "../../components/ModernAlert";

export default function LeaveReviewScreen() {
  const router = useRouter();
  const { orderId, storeId } = useLocalSearchParams();

  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [storeName, setStoreName] = useState<string>("");
  const [alreadyReviewed, setAlreadyReviewed] = useState<boolean>(false);

  const ACTIVE_ORANGE = "#FF8C42";
  const STAR_GOLD = "#F1C40F";

  useEffect(() => {
    async function loadScreenData() {
      try {
        if (!orderId || !storeId) {
          throw new Error("Missing order or store information.");
        }

        // 1. Fetch store info
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("name")
          .eq("id", storeId)
          .single();

        if (storeError || !store) {
          throw new Error("Failed to fetch store details.");
        }
        setStoreName(store.name);

        // 2. Check if a review already exists for this order
        const existingReview = await ReviewService.fetchReviewForOrder(orderId as string);
        if (existingReview) {
          setAlreadyReviewed(true);
        }
      } catch (err: any) {
        console.error("Failed to load review page data:", err);
        showModernAlert({
          title: "Load Failed",
          message: err.message || "Failed to load review data.",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    }

    loadScreenData();
  }, [orderId, storeId]);

  const handleRatingSelect = (selectedRating: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(selectedRating);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showModernAlert({
        title: "Rating Required",
        message: "Please select a star rating between 1 and 5 stars.",
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user session found.");

      // Submit review using service abstraction
      await ReviewService.submitReview({
        user_id: user.id,
        store_id: storeId as string,
        order_id: orderId as string,
        rating,
        feedback: feedback.trim() || null,
      });

      showModernAlert({
        title: "Review Submitted! ✨",
        message: "Thank you for sharing your feedback.",
        type: "success",
      });

      router.back();
    } catch (err: any) {
      console.error("Failed to submit review:", err);
      showModernAlert({
        title: "Submission Failed",
        message: err.message || "Something went wrong while submitting your review.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACTIVE_ORANGE} />
      </View>
    );
  }

  if (alreadyReviewed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1E261E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Review</Text>
          <View style={{ width: 40 }} />
        </View>
        <Animated.View entering={FadeInDown} style={styles.errorContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4A6038" />
          <Text style={styles.errorTitle}>Already Reviewed</Text>
          <Text style={styles.errorSubtitle}>
            You have already reviewed this order. Thank you for your feedback!
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Go Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1E261E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Review</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp} style={styles.card}>
            <Text style={styles.storeLabel}>STORE</Text>
            <Text style={styles.storeName}>{storeName || "Organic Store"}</Text>

            <View style={styles.divider} />

            <Text style={styles.questionText}>How was your harvest order?</Text>

            {/* Stars Row */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRatingSelect(star)}
                  activeOpacity={0.8}
                  style={styles.starTouch}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={42}
                    color={star <= rating ? STAR_GOLD : "#C0CDB8"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Star descriptor */}
            {rating > 0 && (
              <Animated.Text entering={FadeInDown} style={styles.ratingDescriptor}>
                {rating === 1 && "Disappointing 😟"}
                {rating === 2 && "Could be better 😐"}
                {rating === 3 && "Good 🙂"}
                {rating === 4 && "Great! 😊"}
                {rating === 5 && "Excellent! 🌟"}
              </Animated.Text>
            )}

            <View style={styles.divider} />

            {/* Feedback Area */}
            <Text style={styles.feedbackLabel}>Share your experience (optional)</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Fresh vegetables, quick delivery, great packaging..."
              placeholderTextColor="#8A998A"
              multiline
              numberOfLines={4}
              maxLength={300}
              style={styles.feedbackInput}
            />
            <Text style={styles.charCount}>{feedback.length}/300</Text>
          </Animated.View>

          {/* Submit Button */}
          <Animated.View entering={FadeInDown} style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                { backgroundColor: rating === 0 ? "#C0CDB8" : ACTIVE_ORANGE },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#F5F6E9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E261E",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#4A6038",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(240, 242, 217, 0.5)",
    marginBottom: 24,
  },
  storeLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8A998A",
    letterSpacing: 1,
  },
  storeName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E261E",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F2D9",
    marginVertical: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E261E",
    textAlign: "center",
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 12,
  },
  starTouch: {
    padding: 4,
  },
  ratingDescriptor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF8C42",
    textAlign: "center",
    marginTop: 8,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E261E",
    marginBottom: 8,
  },
  feedbackInput: {
    backgroundColor: "#F5F6E9",
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: "#1E261E",
    borderWidth: 1,
    borderColor: "#E0E8D8",
    height: 120,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: "#8A998A",
    textAlign: "right",
    marginTop: 4,
    fontWeight: "600",
  },
  buttonContainer: {
    marginTop: 8,
  },
  submitBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#FF8C42",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E261E",
    marginTop: 20,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 15,
    color: "#8A998A",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: "#4A6038",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
