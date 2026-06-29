import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { searchProducts, getAllCustomers, saveTransaction, searchCustomers } from '../db';
import type { Product, Customer, CartItem, PaymentMethod, SaleType, Transaction, TransactionItem } from '../types';
import { formatCurrency, paymentBgColor } from '../utils';

export function CheckoutPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [notes, setNotes] = useState('');
  const [saleQuantities, setSaleQuantities] = useState<Record<string, { retail: string; wholesale: string }>>({});

  // Product search
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await searchProducts(query);
      setResults(r.slice(0, 20));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // Customer search (only when needed)
  useEffect(() => {
    if (paymentMethod !== 'CREDIT' && paymentMethod !== 'CREDIT_RECOVERY') return;
    const t = setTimeout(async () => {
      const r = await searchCustomers(customerQuery);
      setCustomers(r.slice(0, 10));
    }, 150);
    return () => clearTimeout(t);
  }, [customerQuery, paymentMethod]);

  const parseQtyInput = (value: string) => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
  };

  const getUnitPrice = (product: Product, sale_type: SaleType) => {
    const basePrice = sale_type === 'RETAIL' ? product.retail_price : product.wholesale_price;
    const pieces = typeof product.pieces_per_pack === 'number' && product.pieces_per_pack > 0 ? product.pieces_per_pack : 1;
    return (Number(basePrice) || 0) / pieces;
  };

  const getCostPerUnit = (product: Product) => {
    const pieces = typeof product.pieces_per_pack === 'number' && product.pieces_per_pack > 0 ? product.pieces_per_pack : 1;
    return (Number(product.cost_price) || 0) / pieces;
  };

  const addToCart = useCallback((product: Product, sale_type: SaleType, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.product.id === product.id && c.sale_type === sale_type
      );
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id && c.sale_type === sale_type
            ? { ...c, quantity: c.quantity + quantity }
            : c
        );
      }
      return [...prev, { product, quantity, sale_type }];
    });
    setQuery('');
  }, []);

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) { next.splice(index, 1); } else { next[index] = { ...next[index], quantity: newQty }; }
      return next;
    });
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = getUnitPrice(item.product, item.sale_type);
    return sum + price * item.quantity;
  }, 0);

  const needsCustomer = paymentMethod === 'CREDIT' || paymentMethod === 'CREDIT_RECOVERY';

  const canCheckout =
    paymentMethod === 'CREDIT_RECOVERY'
      ? selectedCustomer !== null && cartTotal > 0 // recovery needs amount entered
      : cart.length > 0 && (!needsCustomer || selectedCustomer !== null);

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const txId = uuidv4();

      const transaction: Transaction = {
        id: txId,
        created_at: now,
        total_amount: cartTotal,
        payment_method: paymentMethod,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        sync_status: 'pending',
        notes: notes || undefined,
      };

      const items: TransactionItem[] = cart.map((cartItem) => ({
        id: uuidv4(),
        transaction_id: txId,
        product_id: cartItem.product.id,
        product_name: cartItem.product.name,
        quantity: cartItem.quantity,
        sale_type: cartItem.sale_type,
        price_per_unit: getUnitPrice(cartItem.product, cartItem.sale_type),
        cost_per_unit: getCostPerUnit(cartItem.product),
      }));

      await saveTransaction(transaction, items);

      // Reset
      setCart([]);
      setQuery('');
      setPaymentMethod('CASH');
      setSelectedCustomer(null);
      setCustomerQuery('');
      setNotes('');
      setSuccessMsg(`✓ Sale of ${formatCurrency(cartTotal)} saved!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Success toast */}
      {successMsg && (
        <div className="mx-3 mt-3 px-4 py-3 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 font-medium text-sm animate-pulse">
          {successMsg}
        </div>
      )}

      {/* ── Product Search ──────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-3 bg-surface-800 border border-surface-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
          />
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && query.trim() && (
          <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden divide-y divide-surface-700">
            {results.map((product) => (
              <div key={product.id} className="px-3 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white text-sm font-medium truncate flex-1 mr-2">{product.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-900 border border-surface-700 rounded-xl p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={saleQuantities[product.id]?.retail ?? '1'}
                        onChange={(e) => setSaleQuantities((prev) => ({
                          ...prev,
                          [product.id]: { ...prev[product.id], retail: e.target.value },
                        }))}
                        className="w-full px-2 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={() => {
                          addToCart(product, 'RETAIL', parseQtyInput(saleQuantities[product.id]?.retail ?? '1'));
                          setSaleQuantities((prev) => ({
                            ...prev,
                            [product.id]: { ...prev[product.id], retail: '1' },
                          }));
                        }}
                        className="px-2 py-2 rounded-lg bg-brand-500/20 text-brand-400 text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-brand-400/80">
                      {formatCurrency(getUnitPrice(product, 'RETAIL'))} / piece
                    </div>
                  </div>
                  <div className="bg-surface-900 border border-surface-700 rounded-xl p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={saleQuantities[product.id]?.wholesale ?? '1'}
                        onChange={(e) => setSaleQuantities((prev) => ({
                          ...prev,
                          [product.id]: { ...prev[product.id], wholesale: e.target.value },
                        }))}
                        className="w-full px-2 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={() => {
                          addToCart(product, 'WHOLESALE', parseQtyInput(saleQuantities[product.id]?.wholesale ?? '1'));
                          setSaleQuantities((prev) => ({
                            ...prev,
                            [product.id]: { ...prev[product.id], wholesale: '1' },
                          }));
                        }}
                        className="px-2 py-2 rounded-lg bg-sky-500/20 text-sky-400 text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-sky-400/80">
                      {formatCurrency(getUnitPrice(product, 'WHOLESALE'))} / piece
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cart ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm">
            <span className="text-4xl mb-2">🛒</span>
            Search and add items above
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item, i) => {
              const price = getUnitPrice(item.product, item.sale_type);
              const lineTotal = price * item.quantity;
              return (
                <div key={`${item.product.id}-${item.sale_type}`} className="flex items-center gap-2 bg-surface-800 rounded-2xl px-3 py-2.5 border border-surface-700">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{item.product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                        item.sale_type === 'RETAIL' ? 'bg-brand-500/20 text-brand-400' : 'bg-sky-500/20 text-sky-400'
                      }`}>
                        {item.sale_type === 'RETAIL' ? 'Retail' : 'Wholesale'}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">{formatCurrency(price)} × {item.quantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQty(i, -1)} className="w-7 h-7 rounded-xl bg-surface-700 text-white hover:bg-rose-500/30 transition-colors text-lg leading-none flex items-center justify-center">−</button>
                    <span className="w-8 text-center text-white font-mono text-sm">{item.quantity}</span>
                    <button onClick={() => updateQty(i, +1)} className="w-7 h-7 rounded-xl bg-surface-700 text-white hover:bg-brand-500/30 transition-colors text-lg leading-none flex items-center justify-center">+</button>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <span className="text-white font-mono font-medium text-sm">{formatCurrency(lineTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Payment Panel ─────────────────────────────────────────────── */}
      <div className="px-3 pb-3 space-y-3 bg-surface-950 border-t border-surface-800 pt-3">
        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Total</span>
          <span className="text-2xl font-mono font-bold text-white">{formatCurrency(cartTotal)}</span>
        </div>

        {/* Payment method buttons */}
        <div className="grid grid-cols-2 gap-2">
          {(['CASH', 'ONLINE', 'CREDIT', 'CREDIT_RECOVERY'] as PaymentMethod[]).map((method) => {
            const labels: Record<PaymentMethod, string> = {
              CASH: '💵 Cash',
              ONLINE: '📱 Online',
              CREDIT: '📒 Credit',
              CREDIT_RECOVERY: '✅ Debt Recovery',
            };
            const isSelected = paymentMethod === method;
            return (
              <button
                key={method}
                onClick={() => { setPaymentMethod(method); setSelectedCustomer(null); setCustomerQuery(''); }}
                className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all ${
                  isSelected
                    ? paymentBgColor(method) + ' text-white'
                    : 'bg-surface-800 border-surface-700 text-slate-400 hover:text-white'
                }`}
              >
                {labels[method]}
              </button>
            );
          })}
        </div>

        {/* Customer selector for credit transactions */}
        {needsCustomer && (
          <div className="space-y-2">
            <input
              value={customerQuery}
              onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null); }}
              placeholder="Search customer name…"
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
            />
            {selectedCustomer ? (
              <div className="flex items-center justify-between px-3 py-2 bg-brand-500/10 border border-brand-500/30 rounded-xl">
                <div>
                  <span className="text-brand-300 text-sm font-medium">{selectedCustomer.name}</span>
                  {selectedCustomer.current_balance > 0 && (
                    <span className="ml-2 text-rose-400 text-xs">Owes {formatCurrency(selectedCustomer.current_balance)}</span>
                  )}
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-500 hover:text-white text-lg">×</button>
              </div>
            ) : customers.length > 0 ? (
              <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-700">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerQuery(c.name); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-700 text-left"
                  >
                    <span className="text-white text-sm">{c.name}</span>
                    {c.current_balance > 0 && (
                      <span className="text-rose-400 text-xs font-mono">{formatCurrency(c.current_balance)}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Notes */}
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-surface-600 text-sm"
        />

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={!canCheckout || saving}
          className={`w-full py-4 rounded-2xl text-base font-semibold transition-all ${
            canCheckout && !saving
              ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30 active:scale-95'
              : 'bg-surface-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : `Save Sale · ${formatCurrency(cartTotal)}`}
        </button>
      </div>
    </div>
  );
}
