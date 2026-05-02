-- Roles enum + table
create type public.app_role as enum ('customer', 'provider');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "users read own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "users insert own roles" on public.user_roles for insert with check (auth.uid() = user_id);

-- Customer profiles
create table public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
create policy "own customer profile read" on public.customer_profiles for select using (auth.uid() = user_id);
create policy "own customer profile insert" on public.customer_profiles for insert with check (auth.uid() = user_id);
create policy "own customer profile update" on public.customer_profiles for update using (auth.uid() = user_id);

-- Business owners: links auth user to a business
create table public.business_owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);
alter table public.business_owners enable row level security;
create policy "owner reads own link" on public.business_owners for select using (auth.uid() = user_id);
create policy "owner inserts own link" on public.business_owners for insert with check (auth.uid() = user_id);

-- Tighten existing tables: drop permissive policies and add proper ones
drop policy if exists p on public.businesses;
create policy "businesses public read" on public.businesses for select using (true);
create policy "owners insert business" on public.businesses for insert to authenticated with check (auth.uid() is not null);
create policy "owners update own business" on public.businesses for update using (
  exists (select 1 from public.business_owners bo where bo.business_id = businesses.id and bo.user_id = auth.uid())
);

drop policy if exists p on public.services;
create policy "services public read" on public.services for select using (true);
create policy "owners manage services" on public.services for all using (
  exists (select 1 from public.business_owners bo where bo.business_id = services.business_id and bo.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_owners bo where bo.business_id = services.business_id and bo.user_id = auth.uid())
);

drop policy if exists p on public.service_categories;
create policy "categories public read" on public.service_categories for select using (true);
create policy "owners manage categories" on public.service_categories for all using (
  exists (select 1 from public.business_owners bo where bo.business_id = service_categories.business_id and bo.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_owners bo where bo.business_id = service_categories.business_id and bo.user_id = auth.uid())
);

drop policy if exists p on public.staff;
create policy "staff public read" on public.staff for select using (true);
create policy "owners manage staff" on public.staff for all using (
  exists (select 1 from public.business_owners bo where bo.business_id = staff.business_id and bo.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_owners bo where bo.business_id = staff.business_id and bo.user_id = auth.uid())
);

drop policy if exists p on public.staff_services;
create policy "staff_services public read" on public.staff_services for select using (true);
create policy "owners manage staff_services" on public.staff_services for all using (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = staff_services.staff_id and bo.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = staff_services.staff_id and bo.user_id = auth.uid()
  )
);

drop policy if exists p on public.availabilities;
create policy "availabilities public read" on public.availabilities for select using (true);
create policy "owners manage availabilities" on public.availabilities for all using (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = availabilities.staff_id and bo.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = availabilities.staff_id and bo.user_id = auth.uid()
  )
);

drop policy if exists p on public.time_blocks;
create policy "time_blocks public read" on public.time_blocks for select using (true);
create policy "owners manage time_blocks" on public.time_blocks for all using (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = time_blocks.staff_id and bo.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.staff s
    join public.business_owners bo on bo.business_id = s.business_id
    where s.id = time_blocks.staff_id and bo.user_id = auth.uid()
  )
);

-- bookings: keep public insert (guests allowed) and public read for now (demo)
drop policy if exists p on public.bookings;
create policy "bookings public read" on public.bookings for select using (true);
create policy "bookings public insert" on public.bookings for insert with check (true);
create policy "owners delete bookings" on public.bookings for delete using (
  exists (select 1 from public.business_owners bo where bo.business_id = bookings.business_id and bo.user_id = auth.uid())
);

-- slot_locks remain open (managed by RPCs)
drop policy if exists p on public.slot_locks;
create policy "locks public" on public.slot_locks for all using (true) with check (true);