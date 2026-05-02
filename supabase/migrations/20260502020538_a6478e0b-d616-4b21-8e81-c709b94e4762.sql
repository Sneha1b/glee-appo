UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'customer-test@schedora.app' AND email_confirmed_at IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'customer'::app_role FROM auth.users WHERE email = 'customer-test@schedora.app'
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_profiles (user_id, first_name, last_name, full_name, phone)
SELECT id, 'Casey', 'Customer', 'Casey Customer', '+1 555 010 2024'
FROM auth.users WHERE email = 'customer-test@schedora.app'
ON CONFLICT (user_id) DO NOTHING;