
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text, timezone text not null default 'UTC',
  address_line1 text, address_line2 text, city text, region text, postal_code text, country text, phone text,
  created_at timestamptz not null default now()
);
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null, duration_min int not null check (duration_min > 0),
  price numeric(10,2) not null default 0, description text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, email text, created_at timestamptz not null default now()
);
create table public.staff_services (
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);
create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1440),
  end_minute int not null check (end_minute between 0 and 1440),
  check (end_minute > start_minute)
);
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  start_at timestamptz not null, end_at timestamptz not null, reason text,
  check (end_at > start_at)
);
create table public.slot_locks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  start_at timestamptz not null, end_at timestamptz not null,
  holder_session_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (staff_id, start_at)
);
create index slot_locks_holder_idx on public.slot_locks (holder_session_id);
create index slot_locks_expires_idx on public.slot_locks (expires_at);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  customer_name text not null, customer_email text not null, customer_phone text,
  start_at timestamptz not null, end_at timestamptz not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  unique (staff_id, start_at)
);
create index bookings_staff_time_idx on public.bookings (staff_id, start_at);

alter table public.businesses enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.availabilities enable row level security;
alter table public.time_blocks enable row level security;
alter table public.slot_locks enable row level security;
alter table public.bookings enable row level security;

create policy "p" on public.businesses for all using (true) with check (true);
create policy "p" on public.service_categories for all using (true) with check (true);
create policy "p" on public.services for all using (true) with check (true);
create policy "p" on public.staff for all using (true) with check (true);
create policy "p" on public.staff_services for all using (true) with check (true);
create policy "p" on public.availabilities for all using (true) with check (true);
create policy "p" on public.time_blocks for all using (true) with check (true);
create policy "p" on public.slot_locks for all using (true) with check (true);
create policy "p" on public.bookings for all using (true) with check (true);

-- FR-5: acquire a 60s lock; clears any expired lock first. Returns the lock row, or null if held by someone else.
create or replace function public.acquire_slot_lock(
  p_holder text, p_staff uuid, p_service uuid, p_start timestamptz, p_end timestamptz
) returns public.slot_locks
language plpgsql security definer set search_path = public as $$
declare v_lock public.slot_locks;
begin
  if exists (select 1 from public.bookings where staff_id = p_staff and start_at = p_start) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;
  delete from public.slot_locks where staff_id = p_staff and start_at = p_start and expires_at <= now();
  insert into public.slot_locks (holder_session_id, staff_id, service_id, start_at, end_at, expires_at)
  values (p_holder, p_staff, p_service, p_start, p_end, now() + interval '60 seconds')
  on conflict (staff_id, start_at) do update
    set holder_session_id = excluded.holder_session_id,
        service_id = excluded.service_id,
        end_at = excluded.end_at,
        created_at = now(),
        expires_at = now() + interval '60 seconds'
    where public.slot_locks.holder_session_id = p_holder
       or public.slot_locks.expires_at <= now()
  returning * into v_lock;
  if v_lock.id is null then raise exception 'slot_locked' using errcode = 'P0001'; end if;
  return v_lock;
end $$;

-- FR-6: explicit release
create or replace function public.release_slot_lock(p_holder text, p_staff uuid, p_start timestamptz)
returns void language sql security definer set search_path = public as $$
  delete from public.slot_locks where staff_id = p_staff and start_at = p_start and holder_session_id = p_holder;
$$;

-- FR-7: atomic lock-to-booking conversion
create or replace function public.confirm_booking(
  p_holder text, p_service uuid, p_staff uuid, p_start timestamptz,
  p_name text, p_email text, p_phone text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_lock public.slot_locks; v_service public.services; v_booking public.bookings;
begin
  select * into v_lock from public.slot_locks
    where staff_id = p_staff and start_at = p_start
      and holder_session_id = p_holder and expires_at > now()
    for update;
  if not found then raise exception 'lock_invalid' using errcode = 'P0001'; end if;
  select * into v_service from public.services where id = p_service;
  if not found then raise exception 'service_not_found'; end if;
  insert into public.bookings (business_id, service_id, staff_id, customer_name, customer_email, customer_phone, start_at, end_at)
  values (v_service.business_id, p_service, p_staff, p_name, p_email, p_phone, p_start, v_lock.end_at)
  returning * into v_booking;
  delete from public.slot_locks where id = v_lock.id;
  return v_booking;
end $$;

-- ============ SEED ============
do $$
declare
  b uuid; c_hair uuid; c_color uuid; c_treat uuid;
  s_cut uuid; s_color uuid; s_blow uuid; s_treat uuid;
  st_alex uuid; st_jamie uuid; st_robin uuid;
  d date := current_date;
begin
  insert into public.businesses (name, category, timezone, address_line1, city, region, postal_code, country, phone)
  values ('Bloom Hair Studio', 'Hair Salon', 'UTC', '128 Linden Ave', 'Brooklyn', 'NY', '11215', 'US', '+1 718-555-0142')
  returning id into b;

  insert into public.service_categories (business_id, name, sort_order) values (b, 'Haircuts', 1) returning id into c_hair;
  insert into public.service_categories (business_id, name, sort_order) values (b, 'Color', 2) returning id into c_color;
  insert into public.service_categories (business_id, name, sort_order) values (b, 'Treatments', 3) returning id into c_treat;

  insert into public.services (business_id, category_id, name, duration_min, price, description) values
    (b, c_hair, 'Classic Cut', 30, 45, 'Wash, cut & style.') returning id into s_cut;
  insert into public.services (business_id, category_id, name, duration_min, price, description) values
    (b, c_hair, 'Blow Dry', 30, 35, 'Smooth blow-dry finish.') returning id into s_blow;
  insert into public.services (business_id, category_id, name, duration_min, price, description) values
    (b, c_color, 'Single Process Color', 90, 110, 'Full color application.') returning id into s_color;
  insert into public.services (business_id, category_id, name, duration_min, price, description) values
    (b, c_treat, 'Deep Conditioning', 60, 65, 'Restorative hair mask.') returning id into s_treat;

  insert into public.staff (business_id, name, email) values (b, 'Alex Rivera', 'alex@bloom.test') returning id into st_alex;
  insert into public.staff (business_id, name, email) values (b, 'Jamie Chen', 'jamie@bloom.test') returning id into st_jamie;
  insert into public.staff (business_id, name, email) values (b, 'Robin Patel', 'robin@bloom.test') returning id into st_robin;

  insert into public.staff_services (staff_id, service_id) values
    (st_alex, s_cut), (st_alex, s_blow), (st_alex, s_color),
    (st_jamie, s_cut), (st_jamie, s_blow), (st_jamie, s_treat),
    (st_robin, s_color), (st_robin, s_treat), (st_robin, s_cut);

  insert into public.availabilities (staff_id, weekday, start_minute, end_minute)
  select s.id, wd, 9*60, 17*60
  from (values (st_alex),(st_jamie),(st_robin)) as v(id)
  join public.staff s on s.id = v.id
  cross join generate_series(1,5) as wd;

  insert into public.availabilities (staff_id, weekday, start_minute, end_minute)
  select s.id, 6, 10*60, 15*60
  from (values (st_alex),(st_jamie),(st_robin)) as v(id)
  join public.staff s on s.id = v.id;

  insert into public.bookings (business_id, service_id, staff_id, customer_name, customer_email, start_at, end_at) values
    (b, s_cut,   st_alex,  'Sam Lee',     'sam@example.com',   (d + 1) + interval '10 hours', (d + 1) + interval '10 hours 30 minutes'),
    (b, s_color, st_robin, 'Morgan Yu',   'morgan@example.com',(d + 1) + interval '13 hours', (d + 1) + interval '14 hours 30 minutes'),
    (b, s_blow,  st_jamie, 'Casey Park',  'casey@example.com', (d + 2) + interval '11 hours', (d + 2) + interval '11 hours 30 minutes'),
    (b, s_treat, st_jamie, 'Jordan Reed', 'jordan@example.com',(d + 3) + interval '14 hours', (d + 3) + interval '15 hours');
end $$;
