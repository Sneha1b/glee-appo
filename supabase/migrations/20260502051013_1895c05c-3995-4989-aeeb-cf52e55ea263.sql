CREATE OR REPLACE FUNCTION public.assign_my_role(p_role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_existing app_role;
  v_can_be_provider boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_role NOT IN ('customer','provider') THEN RAISE EXCEPTION 'invalid_role'; END IF;

  SELECT role INTO v_existing FROM public.user_roles WHERE user_id = v_uid LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, p_role);
    RETURN;
  END IF;

  -- Idempotent: same role already assigned
  IF v_existing = p_role THEN RETURN; END IF;

  -- Allow upgrade customer -> provider when user owns a business or has a pending invite
  IF v_existing = 'customer' AND p_role = 'provider' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.business_owners WHERE user_id = v_uid
      UNION ALL
      SELECT 1 FROM public.business_invites WHERE lower(email) = v_email AND accepted_at IS NULL
    ) INTO v_can_be_provider;
    IF v_can_be_provider THEN
      UPDATE public.user_roles SET role = 'provider' WHERE user_id = v_uid;
      RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'role_already_assigned';
END $function$;