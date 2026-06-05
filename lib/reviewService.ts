import { supabase } from "./supabase";
import { Review, StoreReviewStats } from "../types/review";
import { NotificationService } from "./notificationService";

export const ReviewService = {
  /**
   * Fetch a review associated with a specific completed order
   */
  async fetchReviewForOrder(orderId: string): Promise<Review | null> {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching review for order ${orderId}:`, error);
      throw error;
    }

    return data as Review | null;
  },

  /**
   * Fetch all reviews left for a specific store sorted by created_at DESC
   * Also joins user's profile info
   */
  async fetchReviewsForStore(storeId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`Error fetching reviews for store ${storeId}:`, error);
      throw error;
    }

    return (data as Review[]) || [];
  },

  /**
   * Submit a new customer review to the database
   * Also pushes a notification to the store owner
   */
  async submitReview(
    review: Omit<Review, "id" | "created_at" | "updated_at">
  ): Promise<void> {
    // 1. Submit the review
    const { error: insertError } = await supabase
      .from("reviews")
      .insert({
        rating: review.rating,
        feedback: review.feedback,
        user_id: review.user_id,
        order_id: review.order_id,
        store_id: review.store_id,
      });

    if (insertError) {
      console.error("Error submitting review:", insertError);
      throw insertError;
    }

    // 2. Fetch the store's owner_id
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", review.store_id)
      .single();

    if (storeError || !store) {
      console.error("Error fetching store owner:", storeError);
      return; // Non-blocking if notification fails but review succeeded
    }

    // 3. Create owner notification
    try {
      await NotificationService.createNotification({
        recipient_id: store.owner_id,
        recipient_role: "owner",
        title: "⭐ New Review Received",
        message: `A customer left a ${review.rating}-star review for your store.`,
        type: "NEW_REVIEW",
        order_id: review.order_id,
        store_id: review.store_id,
      });
    } catch (notifError) {
      console.error("Failed to create owner review notification:", notifError);
    }
  },

  /**
   * Calculate analytical stats for a store's reviews
   */
  async fetchStoreReviewStats(storeId: string): Promise<StoreReviewStats> {
    const reviews = await this.fetchReviewsForStore(storeId);
    const totalReviews = reviews.length;
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution,
      };
    }

    let sum = 0;
    reviews.forEach((r) => {
      sum += r.rating;
      const ratingKey = r.rating as 1 | 2 | 3 | 4 | 5;
      if (ratingDistribution[ratingKey] !== undefined) {
        ratingDistribution[ratingKey]++;
      }
    });

    const averageRating = Math.round((sum / totalReviews) * 10) / 10;

    return {
      averageRating,
      totalReviews,
      ratingDistribution,
    };
  },

  /**
   * Subscribe to postgres realtime changes on the reviews table for a store
   */
  subscribeToReviews(storeId: string, onReviewChanged: () => void) {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `realtime-store-reviews-${storeId}-${uniqueId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reviews",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          onReviewChanged();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
