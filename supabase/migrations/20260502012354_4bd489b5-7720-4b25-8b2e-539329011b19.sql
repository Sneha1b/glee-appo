ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

UPDATE public.businesses
SET description = 'Welcome to Bloom Hair Studio — modern cuts, color, and care in the heart of Brooklyn. Book in under a minute and we''ll hold your slot for 60 seconds while you confirm.',
    logo_url = 'https://api.dicebear.com/7.x/initials/svg?seed=Bloom%20Hair%20Studio&backgroundColor=8b5cf6&textColor=ffffff',
    banner_url = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80&auto=format&fit=crop'
WHERE id = 'fa7ac717-43a6-4b28-a707-72d2648252d2' AND description IS NULL;