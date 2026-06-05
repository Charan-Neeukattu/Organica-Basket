-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_store_id_idx ON public.reviews(store_id);
CREATE INDEX IF NOT EXISTS reviews_order_id_idx ON public.reviews(order_id);

-- Add aggregated rating columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Trigger function to update store average_rating and total_reviews automatically
CREATE OR REPLACE FUNCTION public.update_store_ratings()
RETURNS TRIGGER AS $$
DECLARE
  target_store_id UUID;
  avg_rating NUMERIC;
  total_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_store_id := OLD.store_id;
  ELSE
    target_store_id := NEW.store_id;
  END IF;

  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO avg_rating, total_count
  FROM public.reviews
  WHERE store_id = target_store_id;

  UPDATE public.stores
  SET 
    average_rating = ROUND(avg_rating, 1),
    total_reviews = total_count
  WHERE id = target_store_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_review_changed ON public.reviews;
CREATE TRIGGER on_review_changed
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_store_ratings();

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can select reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can insert reviews for their own delivered orders" ON public.reviews;

-- Create RLS Policies
CREATE POLICY "Anyone can select reviews" ON public.reviews
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Customers can insert reviews for their own delivered orders" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND user_id = auth.uid() AND status = 'delivered'
    )
  );

-- Enable Realtime for reviews table
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
