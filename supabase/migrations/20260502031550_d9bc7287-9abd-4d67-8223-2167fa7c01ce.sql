CREATE TABLE IF NOT EXISTS public.provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own provider profile read"
  ON public.provider_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own provider profile insert"
  ON public.provider_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own provider profile update"
  ON public.provider_profiles FOR UPDATE
  USING (auth.uid() = user_id);