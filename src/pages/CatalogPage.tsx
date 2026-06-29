import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getAllProducts, upsertProduct, deleteProduct, searchProducts } from '../db';
import type { Product } from '../types';
import { formatCurrency, parsePriceInput } from '../utils';

type ProductFormState = Omit<Product, 'id' | 'updated_at'>;

const EMPTY_FORM: ProductFormState = {
  name: '',
  cost_price: 0,
  retail_price: 0,
  wholesale_price: 0,
  pieces_per_pack: 1,
  cost_price_per_piece: 0,
};

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = query.trim() ? await searchProducts(query) : await getAllProducts();
    setProducts(r);
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const updateForm = (patch: Partial<ProductFormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.cost_price !== undefined || patch.pieces_per_pack !== undefined) {
        next.cost_price_per_piece = next.pieces_per_pack > 0
          ? Number((next.cost_price / next.pieces_per_pack).toFixed(2))
          : next.cost_price;
      }
      return next;
    });
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      cost_price: p.cost_price,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      pieces_per_pack: p.pieces_per_pack ?? 1,
      cost_price_per_piece: p.cost_price_per_piece ?? 0,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const product: Product = {
        id: editing?.id ?? uuidv4(),
        name: form.name.trim(),
        cost_price: form.cost_price,
        retail_price: form.retail_price,
        wholesale_price: form.wholesale_price,
        pieces_per_pack: form.pieces_per_pack > 0 ? form.pieces_per_pack : 1,
        cost_price_per_piece: form.pieces_per_pack > 0
          ? Number((form.cost_price / form.pieces_per_pack).toFixed(2))
          : form.cost_price,
        updated_at: new Date().toISOString(),
      };
      await upsertProduct(product);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
    setConfirmDelete(null);
    await load();
  };

  const parsePieceCount = (value: string) => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const retailMargin = form.retail_price > 0 && form.cost_price > 0
    ? Math.round(((form.retail_price - form.cost_price) / form.retail_price) * 100)
    : 0;

  const effectivePieces = form.pieces_per_pack > 0 ? form.pieces_per_pack : 1;
  const retailPerPiece = form.retail_price / effectivePieces;
  const wholesalePerPiece = form.wholesale_price / effectivePieces;

  return (
    <div className="px-3 py-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 bg-surface-800 border border-surface-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
          />
        </div>
        <button
          onClick={openNew}
          className="shrink-0 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-semibold transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">{editing ? 'Edit Product' : 'New Product'}</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Product Name</label>
            <input
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g. Basmati Rice 5kg"
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'cost_price', label: 'Cost Price', color: 'text-rose-400' },
              { key: 'retail_price', label: 'Retail Price', color: 'text-brand-400' },
              { key: 'wholesale_price', label: 'Wholesale', color: 'text-sky-400' },
            ] as const).map(({ key, label, color }) => (
              <div key={key}>
                <label className={`text-xs mb-1 block ${color}`}>{label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form[key] || ''}
                  onChange={(e) => updateForm({ [key]: parsePriceInput(e.target.value) })}
                  placeholder="0"
                  className="w-full px-2 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm font-mono"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Pieces in Pack</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.pieces_per_pack ? String(form.pieces_per_pack) : ''}
                onChange={(e) => updateForm({ pieces_per_pack: parsePieceCount(e.target.value) })}
                placeholder="1"
                className="w-full px-2 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-amber-400 mb-1 block">Cost Price / Piece</label>
              <input
                type="text"
                readOnly
                value={form.cost_price_per_piece ? formatCurrency(form.cost_price_per_piece) : '₨ 0'}
                className="w-full px-2 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-slate-600 focus:outline-none text-sm font-mono"
              />
            </div>
          </div>

          {/* Live margin preview */}
          {form.retail_price > 0 && form.cost_price > 0 && (
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Retail margin:</span>
                <span className={`font-medium ${retailMargin > 0 ? 'text-brand-400' : 'text-rose-400'}`}>
                  {retailMargin}%
                </span>
                <span className="mx-1">·</span>
                <span>Profit per unit:</span>
                <span className="text-brand-400 font-medium">
                  {formatCurrency(form.retail_price - form.cost_price)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>Retail / piece:</span>
                <span className="text-brand-400 font-medium">{formatCurrency(retailPerPiece)}</span>
                <span className="mx-1">·</span>
                <span>Wholesale / piece:</span>
                <span className="text-sky-400 font-medium">{formatCurrency(wholesalePerPiece)}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
          >
            {saving ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <div className="text-4xl mb-2">📦</div>
          {query ? 'No matching products' : 'No products yet — add one above'}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="bg-surface-800 border border-surface-700 rounded-2xl px-3 py-3">
              <div className="flex items-start justify-between mb-2">
                <span className="text-white font-medium text-sm flex-1 mr-2">{p.name}</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-surface-700 text-slate-400 hover:text-white transition-colors"
                  >
                    Edit
                  </button>
                  {confirmDelete === p.id ? (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/30 text-rose-400 hover:bg-rose-500/50"
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-surface-700 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-rose-400/70 block">Cost</span>
                  <span className="font-mono text-slate-300">{formatCurrency(p.cost_price)}</span>
                </div>
                <div>
                  <span className="text-brand-400/70 block">Retail</span>
                  <span className="font-mono text-brand-300">{formatCurrency(p.retail_price)}</span>
                </div>
                <div>
                  <span className="text-sky-400/70 block">Wholesale</span>
                  <span className="font-mono text-sky-300">{formatCurrency(p.wholesale_price)}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>Pack size: {(p.pieces_per_pack ?? 1)} pcs</span>
                <span>Cost / piece: {formatCurrency((typeof p.cost_price_per_piece === 'number' && Number.isFinite(p.cost_price_per_piece)) ? p.cost_price_per_piece : ((Number(p.cost_price) || 0) / (p.pieces_per_pack ?? 1)))}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
