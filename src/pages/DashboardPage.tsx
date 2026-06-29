import { useState, useEffect, useCallback } from 'react';
import { computeDailySummary, getTransactionsForDate, getItemsForTransaction } from '../db';
import type { DailySummary, Transaction, TransactionItem } from '../types';
import { formatCurrency, formatTime, todayDateStr, profitMarginPercent, paymentLabel, paymentColor } from '../utils';

function StatCard({
  label, value, sub, accent = 'default'
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'blue' | 'red' | 'amber' | 'default';
}) {
  const accents = {
    green:   'border-brand-500/40 bg-brand-500/10',
    blue:    'border-sky-500/40 bg-sky-500/10',
    red:     'border-rose-500/40 bg-rose-500/10',
    amber:   'border-amber-500/40 bg-amber-500/10',
    default: 'border-surface-700 bg-surface-800',
  };
  const valueColors = {
    green:   'text-brand-400',
    blue:    'text-sky-400',
    red:     'text-rose-400',
    amber:   'text-amber-400',
    default: 'text-white',
  };

  return (
    <div className={`rounded-2xl border p-3.5 ${accents[accent]}`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold ${valueColors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardPage() {
  const [date, setDate] = useState(todayDateStr());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [txItems, setTxItems] = useState<Record<string, TransactionItem[]>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [s, txs] = await Promise.all([
      computeDailySummary(date),
      getTransactionsForDate(date),
    ]);
    setSummary(s);
    setTransactions(txs.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setLoading(false);
  }, [date]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleTx = async (txId: string) => {
    if (expandedTx === txId) { setExpandedTx(null); return; }
    setExpandedTx(txId);
    if (!txItems[txId]) {
      const items = await getItemsForTransaction(txId);
      setTxItems((prev) => ({ ...prev, [txId]: items }));
    }
  };

  const isToday = date === todayDateStr();

  return (
    <div className="px-3 py-3 space-y-4">
      {/* Date selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().slice(0, 10));
          }}
          className="p-2 rounded-xl bg-surface-800 border border-surface-700 text-slate-400 hover:text-white"
        >←</button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 py-2 px-3 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={() => {
            if (isToday) return;
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            setDate(d.toISOString().slice(0, 10));
          }}
          disabled={isToday}
          className="p-2 rounded-xl bg-surface-800 border border-surface-700 text-slate-400 hover:text-white disabled:opacity-30"
        >→</button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading…</div>
      ) : summary ? (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Total Sales"
              value={formatCurrency(summary.total_sales)}
              sub={`${summary.transaction_count} transaction${summary.transaction_count !== 1 ? 's' : ''}`}
              accent="default"
            />
            <StatCard
              label="Net Profit"
              value={formatCurrency(summary.net_profit)}
              sub={`${profitMarginPercent(summary.total_sales, summary.net_profit)}% margin`}
              accent="green"
            />
            <StatCard
              label="💵 Cash"
              value={formatCurrency(summary.cash_collected)}
              accent="default"
            />
            <StatCard
              label="📱 Online"
              value={formatCurrency(summary.online_collected)}
              accent="blue"
            />
            <StatCard
              label="📒 Credit Given"
              value={formatCurrency(summary.new_credit_extended)}
              sub="New debt today"
              accent="red"
            />
            <StatCard
              label="✅ Recovered"
              value={formatCurrency(summary.credit_recovered)}
              sub="Old debt collected"
              accent="amber"
            />
          </div>

          {/* Cash box summary */}
          <div className="rounded-2xl border border-surface-700 bg-surface-800 p-3.5">
            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Cash Box Summary</p>
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-sm">Physical cash + recovery</span>
              <span className="font-mono font-bold text-white text-lg">{formatCurrency(summary.cash_collected + summary.credit_recovered)}</span>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-slate-300 text-sm">Online / bank transfer</span>
              <span className="font-mono text-sky-400">{formatCurrency(summary.online_collected)}</span>
            </div>
          </div>

          {/* Transaction history */}
          {transactions.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Transactions</p>
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => toggleTx(tx.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-750"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${paymentColor(tx.payment_method)}`}>
                            {paymentLabel(tx.payment_method)}
                          </span>
                          {tx.customer_name && (
                            <span className="text-slate-500 text-xs">— {tx.customer_name}</span>
                          )}
                          {tx.sync_status === 'pending' && (
                            <span className="text-amber-500 text-xs">● pending</span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">{formatTime(tx.created_at)}</div>
                      </div>
                      <span className="font-mono font-semibold text-white shrink-0">
                        {formatCurrency(tx.total_amount)}
                      </span>
                      <span className="text-slate-600">{expandedTx === tx.id ? '▲' : '▼'}</span>
                    </button>

                    {expandedTx === tx.id && (
                      <div className="border-t border-surface-700 px-3 py-2 space-y-1.5">
                        {(txItems[tx.id] ?? []).map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-300">
                              {item.product_name} × {item.quantity}
                              <span className={`ml-1.5 text-xs px-1 rounded ${
                                item.sale_type === 'RETAIL' ? 'text-brand-400' : 'text-sky-400'
                              }`}>
                                {item.sale_type === 'RETAIL' ? 'R' : 'W'}
                              </span>
                            </span>
                            <span className="font-mono text-white">
                              {formatCurrency(item.price_per_unit * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {tx.notes && (
                          <p className="text-slate-500 text-xs italic pt-1">{tx.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length === 0 && (
            <div className="text-center py-10 text-slate-600">
              <div className="text-4xl mb-2">📋</div>
              No transactions for this date
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
