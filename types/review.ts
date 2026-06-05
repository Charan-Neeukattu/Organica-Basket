export interface Review {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  store_id: string;
  order_id: string;
  rating: number;
  feedback: string | null;
  
  // Joined profiles relation fields
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface StoreReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
