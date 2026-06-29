import { getPendingTransactions, getItemsForTransactions, markTransactionsSynced } from '../db';

// ─── Supabase Config ────────────────────────────────────────────────────────
// Set these in your .env file as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_KEY;

// ─── Sync State ─────────────────────────────────────────────────────────────
let isSyncing = false;
let syncListeners: ((status: SyncEvent) => void)[] = [];

export type SyncEvent =
  | { type: 'start' }
  | { type: 'success'; synced: number }
  | { type: 'error'; message: string }
  | { type: 'offline' }
  | { type: 'not_configured' };

export function onSyncEvent(cb: (event: SyncEvent) => void): () => void {
  syncListeners.push(cb);
  return () => { syncListeners = syncListeners.filter((l) => l !== cb); };
}

function emit(event: SyncEvent) {
  syncListeners.forEach((l) => l(event));
}

// ─── Core Sync Function ─────────────────────────────────────────────────────
export async function syncPendingToSupabase(): Promise<void> {
  if (isSyncing) return;
  if (!navigator.onLine) { emit({ type: 'offline' }); return; }
  if (!isSupabaseConfigured) { emit({ type: 'not_configured' }); return; }

  isSyncing = true;
  emit({ type: 'start' });

  try {
    const pending = await getPendingTransactions();
    if (pending.length === 0) {
      emit({ type: 'success', synced: 0 });
      isSyncing = false;
      return;
    }

    const pendingIds = pending.map((t) => t.id);
    const items = await getItemsForTransactions(pendingIds);

    // Push transactions
    const txResponse = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(
        pending.map(({ sync_status: _ss, ...tx }) => tx) // strip local-only field
      ),
    });

    if (!txResponse.ok) {
      throw new Error(`Transactions sync failed: ${txResponse.statusText}`);
    }

    // Push transaction items
    if (items.length > 0) {
      const itemsResponse = await fetch(`${SUPABASE_URL}/rest/v1/transaction_items`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY!,
          'Authorization': `Bearer ${SUPABASE_KEY!}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(items),
      });

      if (!itemsResponse.ok) {
        throw new Error(`Items sync failed: ${itemsResponse.statusText}`);
      }
    }

    await markTransactionsSynced(pendingIds);
    emit({ type: 'success', synced: pending.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    emit({ type: 'error', message });
  } finally {
    isSyncing = false;
  }
}

// ─── Auto-sync on Reconnect ─────────────────────────────────────────────────
export function initSyncListener(): () => void {
  const handleOnline = () => {
    // Slight delay to let connection stabilise
    setTimeout(() => syncPendingToSupabase(), 1500);
  };

  window.addEventListener('online', handleOnline);

  // Attempt on first init if already online
  if (navigator.onLine) {
    setTimeout(() => syncPendingToSupabase(), 2000);
  }

  return () => window.removeEventListener('online', handleOnline);
}
