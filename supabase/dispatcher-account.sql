-- Run this in Supabase SQL Editor after creating the dispatcher user in Authentication > Users.
-- It promotes clementmothopa@gmail.com to the private dispatcher role and confirms the email for testing.

alter table public.profiles
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false;

with dispatcher_user as (
  select id, email
  from auth.users
  where lower(email) = lower('clementmothopa@gmail.com')
  limit 1
),
confirmed_user as (
  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'dispatcher',
        'full_name', 'KhutsoMothopa',
        'phone', '+27 72 000 0000'
      )
  where id = (select id from dispatcher_user)
  returning id, email
),
profile_upsert as (
  insert into public.profiles (id, role, full_name, email, phone, email_verified)
  select id, 'dispatcher', 'KhutsoMothopa', email, '+27 72 000 0000', true
  from confirmed_user
  on conflict (id) do update
    set
      role = 'dispatcher',
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      email_verified = true,
      updated_at = now()
  returning id
)
delete from public.customer_profiles
where user_id in (select id from profile_upsert);

delete from public.driver_profiles
where user_id in (
  select id
  from auth.users
  where lower(email) = lower('clementmothopa@gmail.com')
);

select
  users.id,
  users.email,
  users.email_confirmed_at is not null as email_confirmed,
  profiles.role
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where lower(users.email) = lower('clementmothopa@gmail.com');
