
-- Allow providers to own multiple businesses
CREATE OR REPLACE FUNCTION public.create_business_with_owner(
  p_name text,
  p_category text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_address_line2 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- Providers may own multiple businesses; no single-owner restriction.
  INSERT INTO public.businesses(name, category, phone, description, address_line1, address_line2, city, region, postal_code, country, logo_url, banner_url)
  VALUES (p_name, p_category, p_phone, p_description, p_address_line1, p_address_line2, p_city, p_region, p_postal_code, p_country, p_logo_url, p_banner_url)
  RETURNING id INTO v_business_id;
  INSERT INTO public.business_owners(user_id, business_id) VALUES (v_uid, v_business_id);
  RETURN v_business_id;
END $function$;

-- Pending invites for business co-managers (by email)
CREATE TABLE IF NOT EXISTS public.business_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(business_id, email)
);

ALTER TABLE public.business_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read invites for their business"
ON public.business_invites
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.business_owners bo
  WHERE bo.business_id = business_invites.business_id AND bo.user_id = auth.uid()));

CREATE POLICY "invitee reads own invites"
ON public.business_invites
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Owner-only: add a manager invite by email
CREATE OR REPLACE FUNCTION public.invite_business_manager(p_business_id uuid, p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_owners WHERE business_id = p_business_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;
  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  INSERT INTO public.business_invites(business_id, email, invited_by)
  VALUES (p_business_id, v_email, v_uid)
  ON CONFLICT (business_id, email) DO UPDATE SET invited_by = EXCLUDED.invited_by
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.invite_business_manager(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_business_manager(uuid, text) TO authenticated;

-- When invited user signs in, claim pending invites and become co-owner
CREATE OR REPLACE FUNCTION public.accept_pending_business_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN RETURN 0; END IF;
  WITH claimed AS (
    UPDATE public.business_invites
       SET accepted_at = now()
     WHERE lower(email) = v_email AND accepted_at IS NULL
     RETURNING business_id
  ),
  inserted AS (
    INSERT INTO public.business_owners(user_id, business_id)
    SELECT v_uid, business_id FROM claimed
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
END $function$;

REVOKE EXECUTE ON FUNCTION public.accept_pending_business_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pending_business_invites() TO authenticated;

-- Avoid duplicate (user_id, business_id) pairs
CREATE UNIQUE INDEX IF NOT EXISTS business_owners_user_business_uniq
  ON public.business_owners(user_id, business_id);

-- Storage bucket for business logos/banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-images', 'business-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "business images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-images');

CREATE POLICY "authed users upload business images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own business images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'business-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own business images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'business-images' AND auth.uid()::text = (storage.foldername(name))[1]);
