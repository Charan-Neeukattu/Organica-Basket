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
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { ReviewService } from "../../lib/reviewService";
import { Review, StoreReviewStats } from "../../types/review";
import { showModernAlert } from "../../components/ModernAlert";
import { formatRelativeTime } from "../../lib/notificationService";

export default function StoreReviewsScreen() {
  const router = useRouter();
  const { reviewId } = useLocalSearchParams<{ reviewId?: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");
  const [reviewStats, setReviewStats] = useState<StoreReviewStats>({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [cardPositions, setCardPositions] = useState<Record<string, number>>({});

  const ACTIVE_GREEN = "#4A6038";
  const ACTIVE_ORANGE = "#FF8C42";
  const STAR_GOLD = "#F1C40F";

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication user session not found");

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (storeError) throw storeError;
      setStore(storeData);

      if (storeData) {
        const [reviewsData, statsData] = await Promise.all([
          ReviewService.fetchReviewsForStore(storeData.id),
          ReviewService.fetchStoreReviewStats(storeData.id),
        ]);

        setReviews(reviewsData);
        setReviewStats(statsData);
      }
    } catch (err: any) {
      console.error("Failed to load reviews data:", err);
      showModernAlert({
        title: "Load Failed",
        message: err.message || "Failed to load store reviews.",
        type: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription setup
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (store?.id) {
      unsubscribe = ReviewService.subscribeToReviews(store.id, async () => {
        // Fresh reload when database updates
        try {
          const [reviewsData, statsData] = await Promise.all([
            ReviewService.fetchReviewsForStore(store.id),
            ReviewService.fetchStoreReviewStats(store.id),
          ]);
          setReviews(reviewsData);
          setReviewStats(statsData);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          console.error("Failed to update reviews on realtime event:", err);
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [store?.id]);

  useEffect(() => {
    if (reviewId && cardPositions[reviewId] !== undefined && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: cardPositions[reviewId] - 20,
          animated: true,
        });
        setHighlightedReviewId(reviewId);

        const clearTimer = setTimeout(() => {
          setHighlightedReviewId(null);
        }, 3000);
        return () => clearTimeout(clearTimer);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [reviewId, cardPositions]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "highest") {
        return b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "lowest") {
        return a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACTIVE_GREEN} />
      </View>
    );
  }

  const sortedReviews = getSortedReviews();
  const positivePercentage =
    reviewStats.totalReviews > 0
      ? Math.round(
          ((reviewStats.ratingDistribution[4] + reviewStats.ratingDistribution[5]) /
            reviewStats.totalReviews) *
            100
        )
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#1E261E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Reviews</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={22} color={ACTIVE_GREEN} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ACTIVE_GREEN]} />
        }
      >
        {/* Analytics Dashboard */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.analyticsCard}>
          <View style={styles.analyticsOverview}>
            <View style={styles.ratingNumberBox}>
              <Text style={styles.ratingBigText}>{reviewStats.averageRating ? reviewStats.averageRating.toFixed(1) : "0.0"}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(reviewStats.averageRating || 0) ? "star" : "star-outline"}
                    size={14}
                    color={STAR_GOLD}
                  />
                ))}
              </View>
              <Text style={styles.totalReviewsLabel}>{reviewStats.totalReviews} total reviews</Text>
            </View>

            <View style={styles.dividerVertical} />

            <View style={styles.positiveBox}>
              <Text style={styles.positiveBigText}>{positivePercentage}%</Text>
              <Text style={styles.positiveSubText}>Positive Reviews</Text>
              <Text style={styles.positiveDetailText}>Rated 4★ or 5★ stars</Text>
            </View>
          </View>

          <View style={styles.dividerHorizontal} />

          {/* Distribution Graph */}
          <View style={styles.distributionContainer}>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviewStats.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] || 0;
              const percentage =
                reviewStats.totalReviews > 0
                  ? Math.round((count / reviewStats.totalReviews) * 100)
                  : 0;

              return (
                <View key={rating} style={styles.distRow}>
                  <Text style={styles.distStarsText}>{rating} ★</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${percentage}%`,
                          backgroundColor:
                            rating >= 4
                              ? ACTIVE_GREEN
                              : rating === 3
                              ? STAR_GOLD
                              : ACTIVE_ORANGE,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.distCountText}>{count}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Sort & List Container */}
        <View style={styles.listContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer Feedback</Text>
            {/* Sorting options */}
            <View style={styles.sortContainer}>
              {(["newest", "highest", "lowest"] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSortBy(mode);
                  }}
                  style={[
                    styles.sortPill,
                    sortBy === mode && { backgroundColor: ACTIVE_GREEN },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      sortBy === mode && { color: "#fff", fontWeight: "700" },
                    ]}
                  >
                    {mode === "newest" ? "Newest" : mode === "highest" ? "5★ first" : "1★ first"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reviews List */}
          {sortedReviews.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={48} color="#C0CDB8" />
              <Text style={styles.emptyText}>No reviews recorded yet</Text>
              <Text style={styles.emptySubText}>
                Reviews submitted by customers for completed orders will show up here in realtime.
              </Text>
            </Animated.View>
          ) : (
            sortedReviews.map((rev, index) => {
              const customerName = rev.profiles?.full_name || "Customer";
              const avatarLetter = customerName.charAt(0).toUpperCase();

              return (
                <Animated.View
                  key={rev.id}
                  entering={FadeInDown.delay(index * 50)}
                  layout={Layout.springify()}
                  onLayout={(event) => {
                    const layout = event.nativeEvent.layout;
                    setCardPositions((prev) => ({
                      ...prev,
                      [rev.id]: layout.y,
                    }));
                  }}
                  style={[
                    styles.reviewCard,
                    highlightedReviewId === rev.id && styles.highlightedReviewCard,
                  ]}
                >
                  {/* User and Meta Header */}
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{avatarLetter}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.customerName}>{customerName}</Text>
                      <Text style={styles.reviewDate}>
                        Order #{rev.order_id.substring(0, 8)} •{" "}
                        {formatRelativeTime(rev.created_at)}
                      </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color={STAR_GOLD} />
                      <Text style={styles.ratingBadgeText}>{rev.rating}</Text>
                    </View>
                  </View>

                  {/* Review Text */}
                  {rev.feedback ? (
                    <Text style={styles.feedbackText}>{"\""}{rev.feedback}{"\""}</Text>
                  ) : (
                    <Text style={styles.noFeedbackText}>No written feedback provided</Text>
                  )}
                </Animated.View>
              );
            })
          )}
        </View>
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
  refreshBtn: {
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
  scrollContent: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  analyticsCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#4A6038",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(240, 242, 217, 0.5)",
    marginBottom: 24,
  },
  analyticsOverview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  ratingNumberBox: {
    alignItems: "center",
  },
  ratingBigText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#1E261E",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  totalReviewsLabel: {
    fontSize: 11,
    color: "#8A998A",
    fontWeight: "600",
  },
  dividerVertical: {
    width: 1,
    height: 60,
    backgroundColor: "#F0F2D9",
  },
  positiveBox: {
    alignItems: "center",
  },
  positiveBigText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#4A6038",
  },
  positiveSubText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E261E",
    marginTop: 2,
  },
  positiveDetailText: {
    fontSize: 10,
    color: "#8A998A",
    fontWeight: "600",
    marginTop: 2,
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: "#F0F2D9",
    marginVertical: 16,
  },
  distributionContainer: {
    gap: 8,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  distStarsText: {
    width: 32,
    fontSize: 12,
    fontWeight: "700",
    color: "#4A524A",
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#F4F5E6",
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  distCountText: {
    width: 20,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: "#1E261E",
  },
  listContainer: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E261E",
  },
  sortContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(240, 242, 217, 0.5)",
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  sortPillText: {
    fontSize: 11,
    color: "#8A998A",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: "#D0D8C0",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4A6038",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 12,
    color: "#8A998A",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#4A6038",
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(240, 242, 217, 0.3)",
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F4F5E6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#4A6038",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E261E",
  },
  reviewDate: {
    fontSize: 11,
    color: "#8A998A",
    fontWeight: "600",
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF9E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#F1C40F",
  },
  feedbackText: {
    fontSize: 14,
    color: "#4A524A",
    lineHeight: 20,
    marginTop: 12,
    fontStyle: "italic",
  },
  noFeedbackText: {
    fontSize: 13,
    color: "#8A998A",
    fontStyle: "italic",
    marginTop: 12,
  },
  highlightedReviewCard: {
    borderColor: "#F1C40F",
    borderWidth: 2,
    backgroundColor: "#FFFDF0",
    shadowColor: "#F1C40F",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
});
