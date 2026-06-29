import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type {
  Product,
  Customer,
  Transaction,
  TransactionItem,
  DailySummary,
} from '../types';

// ─── Database Class ─────────────────────────────────────────────────────────
class ShopDatabase extends Dexie {
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  transaction_items!: Table<TransactionItem, string>;

  constructor() {
    super('ShopTrackerDB');

    this.version(2).stores({
      // Primary key is always `id`. Indexed fields follow.
      products:          'id, name, updated_at',
      customers:         'id, name, current_balance',
      transactions:      'id, created_at, payment_method, customer_id, sync_status',
      transaction_items: 'id, transaction_id, product_id',
    });
  }
}

export const db = new ShopDatabase();

// ─── Product Operations ─────────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
  return db.products.orderBy('name').toArray();
}

export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return getAllProducts();
  const lower = query.toLowerCase();
  return db.products
    .filter((p) => p.name.toLowerCase().includes(lower))
    .toArray();
}

export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put({ ...product, updated_at: new Date().toISOString() });
}

export async function deleteProduct(id: string): Promise<void> {
  await db.products.delete(id);
}

// ─── Customer Operations ────────────────────────────────────────────────────

export async function getAllCustomers(): Promise<Customer[]> {
  return db.customers.orderBy('name').toArray();
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  if (!query.trim()) return getAllCustomers();
  const lower = query.toLowerCase();
  return db.customers
    .filter((c) => c.name.toLowerCase().includes(lower))
    .toArray();
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return db.customers.get(id);
}

export async function upsertCustomer(customer: Customer): Promise<void> {
  await db.customers.put(customer);
}

export async function updateCustomerBalance(
  customerId: string,
  delta: number  // positive = more owed, negative = paid off
): Promise<void> {
  await db.customers.where('id').equals(customerId).modify((c) => {
    c.current_balance = Math.max(0, c.current_balance + delta);
  });
}

// ─── Transaction Operations ─────────────────────────────────────────────────

export async function saveTransaction(
  transaction: Transaction,
  items: TransactionItem[]
): Promise<void> {
  await db.transaction('rw', db.transactions, db.transaction_items, db.customers, async () => {
    await db.transactions.put(transaction);
    await db.transaction_items.bulkPut(items);

    // Update customer balance for credit transactions
    if (transaction.customer_id) {
      if (transaction.payment_method === 'CREDIT') {
        await updateCustomerBalance(transaction.customer_id, transaction.total_amount);
      } else if (transaction.payment_method === 'CREDIT_RECOVERY') {
        await updateCustomerBalance(transaction.customer_id, -transaction.total_amount);
      }
    }
  });
}

export async function getTransactionsForDate(dateStr: string): Promise<Transaction[]> {
  // dateStr format: 'YYYY-MM-DD'
  const start = new Date(dateStr + 'T00:00:00.000Z').toISOString();
  const end = new Date(dateStr + 'T23:59:59.999Z').toISOString();
  return db.transactions
    .where('created_at')
    .between(start, end, true, true)
    .toArray();
}

export async function getItemsForTransaction(transactionId: string): Promise<TransactionItem[]> {
  return db.transaction_items
    .where('transaction_id')
    .equals(transactionId)
    .toArray();
}

export async function getItemsForTransactions(transactionIds: string[]): Promise<TransactionItem[]> {
  return db.transaction_items
    .where('transaction_id')
    .anyOf(transactionIds)
    .toArray();
}

export async function getCustomerTransactionHistory(customerId: string): Promise<Transaction[]> {
  const transactions = await db.transactions
    .where('customer_id')
    .equals(customerId)
    .toArray();
  return transactions.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ─── Sync Operations ────────────────────────────────────────────────────────

export async function getPendingTransactions(): Promise<Transaction[]> {
  return db.transactions
    .where('sync_status')
    .equals('pending')
    .toArray();
}

export async function markTransactionsSynced(ids: string[]): Promise<void> {
  await db.transactions
    .where('id')
    .anyOf(ids)
    .modify({ sync_status: 'synced' });
}

// ─── Daily Summary Computation ──────────────────────────────────────────────

export async function computeDailySummary(dateStr: string): Promise<DailySummary> {
  const transactions = await getTransactionsForDate(dateStr);

  if (transactions.length === 0) {
    return {
      date: dateStr,
      total_sales: 0,
      net_profit: 0,
      cash_collected: 0,
      online_collected: 0,
      new_credit_extended: 0,
      credit_recovered: 0,
      transaction_count: 0,
    };
  }

  const txIds = transactions.map((t) => t.id);
  const allItems = await getItemsForTransactions(txIds);

  // Build a map for quick lookup: txId → items
  const itemsByTx = new Map<string, TransactionItem[]>();
  for (const item of allItems) {
    const arr = itemsByTx.get(item.transaction_id) ?? [];
    arr.push(item);
    itemsByTx.set(item.transaction_id, arr);
  }

  let total_sales = 0;
  let net_profit = 0;
  let cash_collected = 0;
  let online_collected = 0;
  let new_credit_extended = 0;
  let credit_recovered = 0;

  for (const tx of transactions) {
    const items = itemsByTx.get(tx.id) ?? [];

    // Profit only on actual goods sold (CREDIT_RECOVERY is a debt payment, not a sale)
    if (tx.payment_method !== 'CREDIT_RECOVERY') {
      total_sales += tx.total_amount;
      for (const item of items) {
        net_profit += (item.price_per_unit - item.cost_per_unit) * item.quantity;
      }
    }

    switch (tx.payment_method) {
      case 'CASH':
        cash_collected += tx.total_amount;
        break;
      case 'ONLINE':
        online_collected += tx.total_amount;
        break;
      case 'CREDIT':
        new_credit_extended += tx.total_amount;
        break;
      case 'CREDIT_RECOVERY':
        credit_recovered += tx.total_amount;
        break;
    }
  }

  return {
    date: dateStr,
    total_sales,
    net_profit,
    cash_collected,
    online_collected,
    new_credit_extended,
    credit_recovered,
    transaction_count: transactions.length,
  };
}

// ─── Seed Sample Data (dev/first-run helper) ────────────────────────────────

export async function seedSampleData(): Promise<void> {
  const count = await db.products.count();
  if (count > 0) return; // Already seeded

  const now = new Date().toISOString();

  const products: Product[] = [
    { id: uuidv4(), name: 'Basmati Rice 5kg', cost_price: 450, retail_price: 520, wholesale_price: 490, pieces_per_pack: 1, cost_price_per_piece: 450, updated_at: now },
    { id: uuidv4(), name: 'Sunflower Oil 1L', cost_price: 120, retail_price: 145, wholesale_price: 135, pieces_per_pack: 1, cost_price_per_piece: 120, updated_at: now },
    { id: uuidv4(), name: 'Wheat Flour 10kg', cost_price: 340, retail_price: 400, wholesale_price: 375, pieces_per_pack: 1, cost_price_per_piece: 340, updated_at: now },
    { id: uuidv4(), name: 'Sugar 2kg', cost_price: 90, retail_price: 110, wholesale_price: 102, pieces_per_pack: 1, cost_price_per_piece: 90, updated_at: now },
    { id: uuidv4(), name: 'Tea Leaves 250g', cost_price: 55, retail_price: 70, wholesale_price: 65, pieces_per_pack: 1, cost_price_per_piece: 55, updated_at: now },
    { id: uuidv4(), name: 'Salt 1kg', cost_price: 18, retail_price: 25, wholesale_price: 22, pieces_per_pack: 1, cost_price_per_piece: 18, updated_at: now },
    { id: uuidv4(), name: 'Red Lentils 1kg', cost_price: 75, retail_price: 95, wholesale_price: 88, pieces_per_pack: 1, cost_price_per_piece: 75, updated_at: now },
    { id: uuidv4(), name: 'Chickpeas 500g', cost_price: 45, retail_price: 60, wholesale_price: 55, pieces_per_pack: 1, cost_price_per_piece: 45, updated_at: now },
  ];

  const customers: Customer[] = [
    { id: uuidv4(), name: 'Ahmed Khan', phone: '03001234567', current_balance: 1250 },
    { id: uuidv4(), name: 'Fatima Bibi', phone: '03112345678', current_balance: 0 },
    { id: uuidv4(), name: 'Muhammad Ali', current_balance: 3400 },
  ];

  await db.products.bulkPut(products);
  await db.customers.bulkPut(customers);
}
