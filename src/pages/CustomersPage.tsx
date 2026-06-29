import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllCustomers, upsertCustomer, searchCustomers, getCustomerTransactionHistory, saveTransaction, getCustomerById
} from '../db';
import type { Customer, Transaction } from '../types';
import { formatCurrency, formatDate, formatTime, paymentLabel, paymentColor } from '../utils';

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDebtInput, setShowDebtInput] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [processingDebt, setProcessingDebt] = useState(false);

  const load = useCallback(async () => {
    const r = query.trim() ? await searchCustomers(query) : await getAllCustomers();
    setCustomers(r);
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    const h = await getCustomerTransactionHistory(customer.id);
    setHistory(h);
    setLoadingHistory(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', phone: '' });
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone ?? '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const existing = editingId ? customers.find((c) => c.id === editingId) : null;
      const customer: Customer = {
        id: editingId ?? uuidv4(),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        current_balance: existing?.current_balance ?? 0,
      };
      await upsertCustomer(customer);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const totalCredit = customers.reduce((s, c) => s + c.current_balance, 0);

  // ── Customer Detail View ──────────────────────────────────────────────────
  if (selectedCustomer) {
    return (
      <div className="px-3 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="p-2 rounded-xl bg-surface-800 border border-surface-700 text-slate-400 hover:text-white"
          >←</button>
          <h2 className="text-white font-semibold text-lg flex-1">{selectedCustomer.name}</h2>
          <button
            onClick={() => openEdit(selectedCustomer)}
            className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-slate-400 hover:text-white text-sm"
          >Edit</button>
        </div>

        {/* Balance card */}
        <div className={`rounded-2xl border p-4 ${
          selectedCustomer.current_balance > 0
            ? 'bg-rose-500/10 border-rose-500/40'
            : 'bg-brand-500/10 border-brand-500/40'
        }`}>
          <p className="text-xs text-slate-400 mb-1">Outstanding Balance</p>
          <p className={`text-3xl font-mono font-bold ${
            selectedCustomer.current_balance > 0 ? 'text-rose-400' : 'text-brand-400'
          }`}>
            {formatCurrency(selectedCustomer.current_balance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {selectedCustomer.current_balance > 0 ? 'Owes your shop' : 'All clear ✓'}
          </p>
          {selectedCustomer.phone && (
            <a
              href={`tel:${selectedCustomer.phone}`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-sky-400 hover:text-sky-300"
            >
              📞 {selectedCustomer.phone}
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowDebtInput((s) => !s)}
              className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-slate-400 hover:text-white text-sm"
            >
              Debt Recovery
            </button>
          </div>
          {showDebtInput && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="Amount paid"
                  className="flex-1 px-3 py-2 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none text-sm"
                />
                <button
                  onClick={async () => {
                    const amt = parseFloat(debtAmount.replace(/[^0-9.]/g, '')) || 0;
                    if (amt <= 0) return;
                    const pay = Math.min(amt, selectedCustomer.current_balance || 0);
                    setProcessingDebt(true);
                    try {
                      const now = new Date().toISOString();
                      const tx = {
                        id: uuidv4(),
                        created_at: now,
                        total_amount: pay,
                        payment_method: 'CREDIT_RECOVERY' as const,
                        customer_id: selectedCustomer.id,
                        customer_name: selectedCustomer.name,
                        sync_status: 'pending' as const,
                        notes: 'Debt recovery',
                      };
                      await saveTransaction(tx, []);
                      // Refresh customer and history
                      await load();
                      const updated = await getCustomerById(selectedCustomer.id);
                      if (updated) setSelectedCustomer(updated);
                      const h = await getCustomerTransactionHistory(selectedCustomer.id);
                      setHistory(h);
                      setDebtAmount('');
                      setShowDebtInput(false);
                    } finally {
                      setProcessingDebt(false);
                    }
                  }}
                  disabled={processingDebt}
                  className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm"
                >
                  {processingDebt ? 'Processing…' : 'Confirm'}
                </button>
              </div>
              <div className="text-xs text-slate-500">Enter amount to subtract from customer's debt.</div>
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div>
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Transaction History</p>
          {loadingHistory ? (
            <p className="text-slate-500 text-sm text-center py-6">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => (
                <div key={tx.id} className="bg-surface-800 border border-surface-700 rounded-2xl px-3 py-3 flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-medium ${paymentColor(tx.payment_method)}`}>
                      {paymentLabel(tx.payment_method)}
                    </span>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {formatDate(tx.created_at)} · {formatTime(tx.created_at)}
                    </div>
                  </div>
                  <span className={`font-mono font-semibold ${
                    tx.payment_method === 'CREDIT_RECOVERY' ? 'text-brand-400' : 'text-white'
                  }`}>
                    {tx.payment_method === 'CREDIT_RECOVERY' ? '- ' : '+ '}
                    {formatCurrency(tx.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Customer List View ────────────────────────────────────────────────────
  return (
    <div className="px-3 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="w-full pl-9 pr-4 py-2.5 bg-surface-800 border border-surface-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
          />
        </div>
        <button
          onClick={openNew}
          className="shrink-0 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-semibold"
        >
          + Add
        </button>
      </div>

      {/* Total credit summary */}
      {totalCredit > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Outstanding Credit</span>
          <span className="font-mono font-bold text-rose-400 text-lg">{formatCurrency(totalCredit)}</span>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">{editingId ? 'Edit Customer' : 'New Customer'}</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white text-xl">×</button>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Customer name"
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Phone (optional)</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="03001234567"
              type="tel"
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm"
          >
            {saving ? 'Saving…' : editingId ? 'Update' : 'Add Customer'}
          </button>
        </div>
      )}

      {/* Customer list */}
      {customers.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <div className="text-4xl mb-2">👤</div>
          {query ? 'No matching customers' : 'No customers yet'}
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c)}
              className="w-full flex items-center justify-between bg-surface-800 border border-surface-700 rounded-2xl px-3 py-3 hover:border-surface-600 transition-colors text-left"
            >
              <div>
                <div className="text-white font-medium text-sm">{c.name}</div>
                {c.phone && <div className="text-slate-500 text-xs mt-0.5">{c.phone}</div>}
              </div>
              <div className="text-right shrink-0">
                {c.current_balance > 0 ? (
                  <>
                    <div className="text-rose-400 font-mono font-semibold text-sm">{formatCurrency(c.current_balance)}</div>
                    <div className="text-slate-600 text-xs">owes</div>
                  </>
                ) : (
                  <div className="text-brand-400 text-sm">Clear ✓</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
