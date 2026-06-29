-- ============================================================
-- Shop Tracker — Supabase Cloud Schema
-- Run this in your Supabase SQL editor to set up remote tables
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── products ──────────────────────────────────────────────────────────────
create table if not exists products (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  cost_price       numeric(10, 2) not null default 0,
  retail_price     numeric(10, 2) not null default 0,
  wholesale_price  numeric(10, 2) not null default 0,
  pieces_per_pack  integer not null default 1,
  cost_price_per_piece numeric(10, 2) not null default 0,
  updated_at       timestamptz not null default now()
);

-- ── customers ─────────────────────────────────────────────────────────────
create table if not exists customers (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  phone            text,
  current_balance  numeric(10, 2) not null default 0
);

-- ── transactions ──────────────────────────────────────────────────────────
create table if not exists transactions (
  id               uuid primary key,
  created_at       timestamptz not null,
  total_amount     numeric(10, 2) not null,
  payment_method   text not null check (payment_method in ('CASH', 'ONLINE', 'CREDIT', 'CREDIT_RECOVERY')),
  customer_id      uuid references customers(id),
  customer_name    text,
  notes            text
  -- Note: sync_status is a LOCAL-ONLY field, intentionally excluded from cloud schema
);

create index if not exists idx_transactions_created_at on transactions(created_at);
create index if not exists idx_transactions_customer_id on transactions(customer_id);

-- ── transaction_items ─────────────────────────────────────────────────────
create table if not exists transaction_items (
  id               uuid primary key,
  transaction_id   uuid not null references transactions(id) on delete cascade,
  product_id       uuid not null references products(id),
  product_name     text not null,
  quantity         numeric(10, 3) not null,
  sale_type        text not null check (sale_type in ('RETAIL', 'WHOLESALE')),
  price_per_unit   numeric(10, 2) not null,
  cost_per_unit    numeric(10, 2) not null
);

create index if not exists idx_tx_items_transaction_id on transaction_items(transaction_id);

-- ── Row Level Security (optional but recommended) ─────────────────────────
-- Enable RLS to restrict access to authenticated users only
-- alter table products enable row level security;
-- alter table customers enable row level security;
-- alter table transactions enable row level security;
-- alter table transaction_items enable row level security;
