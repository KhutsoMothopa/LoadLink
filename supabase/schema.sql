-- LoadLink production foundation for Supabase/Postgres.
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.profile_role as enum ('customer', 'driver', 'dispatcher');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.booking_status as enum (
    'awaiting_payment',
    'waiting_for_dispatch',
    'driver_assigned',
    'driver_accepted',
    'driver_on_the_way',
    'goods_collected',
    'delivered',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.driver_status as enum ('offline', 'available', 'on_job');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null,
  full_name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false;

create table if not exists public.customer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_pickup_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text not null,
  number_plate text not null,
  licence_number text not null,
  permit_number text,
  current_location_key text,
  current_location_label text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  availability boolean not null default false,
  status public.driver_status not null default 'offline',
  rating numeric(3, 2) not null default 5.00,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  assigned_driver_id uuid references public.driver_profiles(user_id),
  status public.booking_status not null default 'awaiting_payment',
  pickup_address text not null,
  dropoff_address text not null,
  pickup_location_key text,
  dropoff_location_key text,
  pickup_latitude numeric(10, 7),
  pickup_longitude numeric(10, 7),
  dropoff_latitude numeric(10, 7),
  dropoff_longitude numeric(10, 7),
  vehicle_key text not null,
  vehicle_label text not null,
  load_type_key text not null,
  load_label text not null,
  pickup_date date,
  pickup_time time,
  notes text,
  distance_km numeric(8, 2) not null default 0,
  customer_price numeric(12, 2) not null default 0,
  driver_payout numeric(12, 2) not null default 0,
  payment_status text not null default 'unpaid',
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  status public.booking_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(user_id),
  amount numeric(12, 2) not null,
  status text not null default 'pending',
  payable_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_dispatcher()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'dispatcher'
  );
$$;

alter table public.profiles enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.driver_payouts enable row level security;

drop policy if exists "profiles_select_own_or_dispatcher" on public.profiles;
create policy "profiles_select_own_or_dispatcher"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_dispatcher());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_dispatcher" on public.profiles;
create policy "profiles_update_own_or_dispatcher"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_dispatcher())
with check (id = auth.uid() or public.is_dispatcher());

drop policy if exists "customer_profiles_own_or_dispatcher" on public.customer_profiles;
create policy "customer_profiles_own_or_dispatcher"
on public.customer_profiles for all
to authenticated
using (user_id = auth.uid() or public.is_dispatcher())
with check (user_id = auth.uid() or public.is_dispatcher());

drop policy if exists "driver_profiles_own_or_dispatcher" on public.driver_profiles;
create policy "driver_profiles_own_or_dispatcher"
on public.driver_profiles for all
to authenticated
using (user_id = auth.uid() or public.is_dispatcher())
with check (user_id = auth.uid() or public.is_dispatcher());

drop policy if exists "bookings_customer_driver_dispatcher_select" on public.bookings;
create policy "bookings_customer_driver_dispatcher_select"
on public.bookings for select
to authenticated
using (
  customer_id = auth.uid()
  or assigned_driver_id = auth.uid()
  or public.is_dispatcher()
);

drop policy if exists "bookings_customer_insert" on public.bookings;
create policy "bookings_customer_insert"
on public.bookings for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "bookings_customer_driver_dispatcher_update" on public.bookings;
create policy "bookings_customer_driver_dispatcher_update"
on public.bookings for update
to authenticated
using (
  customer_id = auth.uid()
  or assigned_driver_id = auth.uid()
  or public.is_dispatcher()
)
with check (
  customer_id = auth.uid()
  or assigned_driver_id = auth.uid()
  or public.is_dispatcher()
);

drop policy if exists "booking_events_related_people" on public.booking_events;
create policy "booking_events_related_people"
on public.booking_events for all
to authenticated
using (
  public.is_dispatcher()
  or exists (
    select 1 from public.bookings
    where bookings.id = booking_events.booking_id
      and (bookings.customer_id = auth.uid() or bookings.assigned_driver_id = auth.uid())
  )
)
with check (
  public.is_dispatcher()
  or exists (
    select 1 from public.bookings
    where bookings.id = booking_events.booking_id
      and (bookings.customer_id = auth.uid() or bookings.assigned_driver_id = auth.uid())
  )
);

drop policy if exists "driver_payouts_driver_or_dispatcher" on public.driver_payouts;
create policy "driver_payouts_driver_or_dispatcher"
on public.driver_payouts for select
to authenticated
using (driver_id = auth.uid() or public.is_dispatcher());

create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_assigned_driver_id on public.bookings(assigned_driver_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_driver_profiles_status on public.driver_profiles(status, availability);
create index if not exists idx_driver_payouts_driver_id on public.driver_payouts(driver_id);

-- Dispatcher accounts should not self-register through the public UI.
-- Create the dispatcher user in Supabase Auth, then run:
--
-- insert into public.profiles (id, role, full_name, email, phone)
-- values ('AUTH_USER_UUID', 'dispatcher', 'Dispatcher Name', 'dispatcher@example.com', '+27...')
-- on conflict (id) do update set role = 'dispatcher';
