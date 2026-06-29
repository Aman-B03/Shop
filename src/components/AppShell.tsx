import { useState } from 'react';
import { useOnlineStatus, useSyncStatus } from '../hooks/useOnlineStatus';
import { syncPendingToSupabase, isSupabaseConfigured } from '../sync';

// View pages
import { CheckoutPage } from '../pages/CheckoutPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CatalogPage } from '../pages/CatalogPage';
import { CustomersPage } from '../pages/CustomersPage';

type View = 'checkout' | 'dashboard' | 'catalog' | 'customers';

export function AppShell() {
  const [view, setView] = useState<View>('checkout');
  const isOnline = useOnlineStatus();
  const syncEvent = useSyncStatus();

  const isSyncing = syncEvent?.type === 'start';

  return (
    <div className="flex flex-col h-screen bg-surface-900 text-slate-100 overflow-hidden font-sans">
      {/* ── Top Status Bar ───────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 bg-surface-950 border-b border-surface-800 shrink-0">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-white">
            {view === 'checkout'  && '🛒 Counter'}
            {view === 'dashboard' && '📊 Today\'s Ledger'}
            {view === 'catalog'   && '📦 Price Book'}
            {view === 'customers' && '👤 Customers'}
          </h1>
        </div>

        {/* Online/Sync indicator */}
        <div className="flex items-center gap-2">
          {isSupabaseConfigured && (
            <button
              onClick={() => syncPendingToSupabase()}
              disabled={!isOnline || isSyncing}
              className="text-xs px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              {isSyncing ? '↻ Syncing…' : '↑ Sync'}
            </button>
          )}
          <span className={`flex items-center gap-1 text-xs font-medium ${isOnline ? 'text-brand-400' : 'text-rose-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-brand-400' : 'bg-rose-400'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Sync status toast */}
      {syncEvent && syncEvent.type === 'success' && syncEvent.synced > 0 && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 text-xs shrink-0">
          ✓ Synced {syncEvent.synced} transaction{syncEvent.synced !== 1 ? 's' : ''}
        </div>
      )}
      {syncEvent?.type === 'error' && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs shrink-0">
          ✗ Sync failed — data saved locally
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {view === 'checkout'  && <CheckoutPage />}
        {view === 'dashboard' && <DashboardPage />}
        {view === 'catalog'   && <CatalogPage />}
        {view === 'customers' && <CustomersPage />}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────────── */}
      <nav className="flex items-stretch bg-surface-950 border-t border-surface-800 shrink-0 safe-area-pb">
        {(
          [
            { id: 'checkout',  label: 'Counter',   icon: '🛒' },
            { id: 'dashboard', label: 'Ledger',    icon: '📊' },
            { id: 'catalog',   label: 'Prices',    icon: '📦' },
            { id: 'customers', label: 'Customers', icon: '👤' },
          ] as { id: View; label: string; icon: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors
              ${view === tab.id
                ? 'text-brand-400 border-t-2 border-brand-400 -mt-px bg-brand-500/5'
                : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
