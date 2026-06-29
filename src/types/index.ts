// ─── Payment Method ────────────────────────────────────────────────────────
export type PaymentMethod = 'CASH' | 'ONLINE' | 'CREDIT' | 'CREDIT_RECOVERY';

// ─── Sale Type ─────────────────────────────────────────────────────────────
export type SaleType = 'RETAIL' | 'WHOLESALE';

// ─── Sync Status ───────────────────────────────────────────────────────────
export type SyncStatus = 'pending' | 'synced';

// ─── Product ───────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  pieces_per_pack: number;
  cost_price_per_piece: number;
  updated_at: string; // ISO timestamp
}

// ─── Customer ──────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  current_balance: number; // Total owed to shop (positive = owes money)
}

// ─── Transaction ───────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  created_at: string; // ISO timestamp
  total_amount: number;
  payment_method: PaymentMethod;
  customer_id?: string; // Required if CREDIT or CREDIT_RECOVERY
  customer_name?: string; // Denormalised for display speed
  sync_status: SyncStatus; // Local-only field
  notes?: string;
}

// ─── Transaction Item ──────────────────────────────────────────────────────
export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name: string; // Denormalised snapshot
  quantity: number;
  sale_type: SaleType;
  price_per_unit: number; // Locked at time of sale
  cost_per_unit: number;  // Locked at time of sale
}

// ─── Cart Item (ephemeral, in-memory only) ─────────────────────────────────
export interface CartItem {
  product: Product;
  quantity: number;
  sale_type: SaleType;
}

// ─── Daily Summary ─────────────────────────────────────────────────────────
export interface DailySummary {
  date: string;
  total_sales: number;
  net_profit: number;
  cash_collected: number;
  online_collected: number;
  new_credit_extended: number;
  credit_recovered: number;
  transaction_count: number;
}
