create extension if not exists pgcrypto;

create table if not exists public.reminder_devices (
  id uuid primary key,
  token_hash text not null,
  onesignal_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.reminder_devices(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reminders_due_idx
  on public.reminders (scheduled_at)
  where status = 'pending';

create index if not exists reminders_device_idx
  on public.reminders (device_id, created_at desc);

alter table public.reminder_devices enable row level security;
alter table public.reminders enable row level security;

-- Semua akses dilakukan melalui Vercel API memakai service-role key.
-- Jangan membuat policy publik untuk kedua tabel ini.
