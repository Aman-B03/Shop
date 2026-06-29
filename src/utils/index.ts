// ─── Currency ────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number | null | undefined): string {
  const numericAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;

  // Format as Pakistani Rupees with comma separators
  return '₨ ' + numericAmount.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Date Helpers ────────────────────────────────────────────────────────────
export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── ID Generation ────────────────────────────────────────────────────────────
export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Number Parsing ───────────────────────────────────────────────────────────
export function parsePriceInput(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Profit Margin ────────────────────────────────────────────────────────────
export function profitMarginPercent(revenue: number, profit: number): number {
  if (revenue === 0) return 0;
  return Math.round((profit / revenue) * 100);
}

// ─── Payment Method Labels ────────────────────────────────────────────────────
export function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'Cash',
    ONLINE: 'Online',
    CREDIT: 'Credit (Udhaar)',
    CREDIT_RECOVERY: 'Debt Recovery',
  };
  return labels[method] ?? method;
}

export function paymentColor(method: string): string {
  const colors: Record<string, string> = {
    CASH:             'text-brand-400',
    ONLINE:           'text-sky-400',
    CREDIT:           'text-rose-400',
    CREDIT_RECOVERY:  'text-amber-400',
  };
  return colors[method] ?? 'text-slate-400';
}

export function paymentBgColor(method: string): string {
  const colors: Record<string, string> = {
    CASH:             'bg-brand-500/20 border-brand-500/40',
    ONLINE:           'bg-sky-500/20 border-sky-500/40',
    CREDIT:           'bg-rose-500/20 border-rose-500/40',
    CREDIT_RECOVERY:  'bg-amber-500/20 border-amber-500/40',
  };
  return colors[method] ?? 'bg-slate-500/20 border-slate-500/40';
}
