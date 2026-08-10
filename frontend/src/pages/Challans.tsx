import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useDebounce } from '../hooks/useDebounce';
import type {
  Challan,
  ChallanStatus,
  ChallanItem,
  Customer,
  Product,
  PaginatedMeta,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ChallanStatus, { cls: string; label: string }> = {
  DRAFT: { cls: 'bg-slate-100 text-slate-600', label: 'Draft' },
  CONFIRMED: { cls: 'bg-emerald-100 text-emerald-700', label: 'Confirmed' },
  CANCELLED: { cls: 'bg-red-100 text-red-600', label: 'Cancelled' },
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400';

// ─── Searchable dropdown ───────────────────────────────────────────────────────

interface SearchDropdownProps<T> {
  placeholder: string;
  value: string;
  onChange: (id: string, label: string) => void;
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSearch: (q: string) => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
}

function SearchDropdown<T>({
  placeholder,
  value,
  onChange,
  items,
  getKey,
  getLabel,
  onSearch,
  searchValue,
  onSearchChange,
}: SearchDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  useDebounce(searchValue, 300, onSearch);

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? searchValue : value}
        onChange={(e) => { onSearchChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
      />
      {open && items.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {items.map((item) => (
            <button
              key={getKey(item)}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 text-slate-700 hover:text-violet-700 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(getKey(item), getLabel(item));
                onSearchChange(getLabel(item));
                setOpen(false);
              }}
            >
              {getLabel(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Challan builder item ──────────────────────────────────────────────────────

interface LineItem {
  productId: string;
  productLabel: string;
  productSearch: string;
  quantity: string;
}

const emptyLine = (): LineItem => ({
  productId: '',
  productLabel: '',
  productSearch: '',
  quantity: '1',
});

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Challans() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'SALES';

  // ─── List state ────────────────────────────────────────────────────────────
  const [challans, setChallans] = useState<Challan[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ChallanStatus | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterCustomerLabel, setFilterCustomerLabel] = useState('');
  const [filterCustomers, setFilterCustomers] = useState<Customer[]>([]);

  useDebounce(customerSearch, 350, setDebouncedCustomerSearch);

  // Fetch customers for filter
  useEffect(() => {
    if (!debouncedCustomerSearch) { setFilterCustomers([]); return; }
    void api.get(`/customers?q=${debouncedCustomerSearch}&limit=8`).then((r) => setFilterCustomers(r.data.data));
  }, [debouncedCustomerSearch]);

  // ─── Fetch challans ────────────────────────────────────────────────────────
  const fetchChallans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (statusFilter) params.set('status', statusFilter);
      if (filterCustomerId) params.set('customerId', filterCustomerId);
      const res = await api.get(`/challans?${params}`);
      setChallans(res.data.data);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, filterCustomerId]);

  useEffect(() => { void fetchChallans(); }, [fetchChallans]);
  useEffect(() => { setPage(1); }, [statusFilter, filterCustomerId]);

  // ─── Detail modal state ────────────────────────────────────────────────────
  const [detailChallan, setDetailChallan] = useState<Challan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | string[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const openDetail = async (c: Challan) => {
    setActionError(null);
    setDetailLoading(true);
    const res = await api.get(`/challans/${c.id}`);
    setDetailChallan(res.data.data as Challan);
    setDetailLoading(false);
  };

  // ─── Confirm challan ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!detailChallan) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.put(`/challans/${detailChallan.id}/confirm`);
      setDetailChallan(res.data.data as Challan);
      void fetchChallans();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; details?: string[] } } };
      const d = ax.response?.data;
      if (d?.details) {
        setActionError(d.details);
      } else {
        setActionError(d?.error ?? 'Failed to confirm challan.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Cancel challan ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!detailChallan) return;
    setCancelConfirmOpen(false);
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.put(`/challans/${detailChallan.id}/cancel`);
      setDetailChallan(res.data.data as Challan);
      void fetchChallans();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setActionError(ax.response?.data?.error ?? 'Failed to cancel challan.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── New challan form ──────────────────────────────────────────────────────
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newCustomerLabel, setNewCustomerLabel] = useState('');
  const [newCustomerSearch, setNewCustomerSearch] = useState('');
  const [newCustomers, setNewCustomers] = useState<Customer[]>([]);
  const [debouncedNewCustomerSearch, setDebouncedNewCustomerSearch] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [productSearches, setProductSearches] = useState<Product[][]>([[]]);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useDebounce(newCustomerSearch, 300, setDebouncedNewCustomerSearch);
  useEffect(() => {
    if (!debouncedNewCustomerSearch) { setNewCustomers([]); return; }
    void api.get(`/customers?q=${debouncedNewCustomerSearch}&limit=8`).then((r) => setNewCustomers(r.data.data));
  }, [debouncedNewCustomerSearch]);

  const fetchProductsForLine = async (idx: number, q: string) => {
    if (!q) { setProductSearches((ps) => { const copy = [...ps]; copy[idx] = []; return copy; }); return; }
    const res = await api.get(`/products?q=${q}&limit=8`);
    setProductSearches((ps) => {
      const copy = [...ps];
      copy[idx] = res.data.data as Product[];
      return copy;
    });
  };

  const updateLine = (idx: number, field: keyof LineItem, val: string) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addLine = () => {
    setLines((l) => [...l, emptyLine()]);
    setProductSearches((ps) => [...ps, []]);
  };

  const removeLine = (idx: number) => {
    setLines((l) => l.filter((_, i) => i !== idx));
    setProductSearches((ps) => ps.filter((_, i) => i !== idx));
  };

  const totalQty = lines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0);

  const openNew = () => {
    setNewCustomerId('');
    setNewCustomerLabel('');
    setNewCustomerSearch('');
    setNewCustomers([]);
    setLines([emptyLine()]);
    setProductSearches([[]]);
    setFormError('');
    setShowNewModal(true);
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCustomerId) { setFormError('Please select a customer.'); return; }
    const invalidLines = lines.filter((l) => !l.productId || parseInt(l.quantity) < 1);
    if (invalidLines.length > 0) { setFormError('Each line must have a product and a quantity ≥ 1.'); return; }
    setFormError('');
    setFormLoading(true);
    try {
      await api.post('/challans', {
        customerId: newCustomerId,
        items: lines.map((l) => ({ productId: l.productId, quantity: parseInt(l.quantity) })),
      });
      setShowNewModal(false);
      void fetchChallans();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error ?? 'Failed to create challan.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Sales Challans</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meta.total} total challans</p>
        </div>
        {canWrite && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> New Challan
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ChallanStatus | '')}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 w-40"
        >
          <option value="">All Status</option>
          {(['DRAFT', 'CONFIRMED', 'CANCELLED'] as ChallanStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Filter by customer…"
            value={filterCustomerLabel || customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              if (!e.target.value) { setFilterCustomerId(''); setFilterCustomerLabel(''); }
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {filterCustomers.length > 0 && customerSearch && !filterCustomerId && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filterCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-violet-50 text-slate-700"
                  onClick={() => {
                    setFilterCustomerId(c.id);
                    setFilterCustomerLabel(c.name);
                    setCustomerSearch('');
                    setFilterCustomers([]);
                  }}
                >
                  {c.name} {c.businessName ? `— ${c.businessName}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        {filterCustomerId && (
          <button
            onClick={() => { setFilterCustomerId(''); setFilterCustomerLabel(''); setCustomerSearch(''); }}
            className="px-3 py-2 text-xs text-slate-500 hover:text-red-500 border border-slate-300 rounded-lg transition-colors"
          >
            ✕ Clear customer
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="flex gap-2 items-center text-sm">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Loading challans…
            </div>
          </div>
        ) : challans.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm font-medium text-slate-500">No challans found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Challan #', 'Customer', 'Status', 'Total Qty', 'Created'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challans.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => void openDetail(c)}
                    className="hover:bg-violet-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-slate-800 font-medium text-xs">{c.challanNumber}</td>
                    <td className="px-5 py-3.5 text-slate-700">{c.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[c.status].cls}`}>
                        {STATUS_BADGE[c.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{c.totalQuantity}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
            <span>Page {meta.page} of {meta.totalPages} ({meta.total} records)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors text-xs">
                ← Prev
              </button>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors text-xs">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── New Challan Modal ───────────────────────────────────────────────── */}
      {showNewModal && (
        <Modal title="New Sales Challan" onClose={() => setShowNewModal(false)} width="max-w-xl">
          <form onSubmit={(e) => void submitNew(e)} className="space-y-5">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {formError}
              </div>
            )}

            {/* Customer selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Customer <span className="text-red-400">*</span>
              </label>
              <SearchDropdown
                placeholder="Search customer…"
                value={newCustomerLabel}
                onChange={(id, label) => { setNewCustomerId(id); setNewCustomerLabel(label); }}
                items={newCustomers}
                getKey={(c: Customer) => c.id}
                getLabel={(c: Customer) => `${c.name}${c.businessName ? ` — ${c.businessName}` : ''}`}
                onSearch={(q) => {
                  void api.get(`/customers?q=${q}&limit=8`).then((r) => setNewCustomers(r.data.data));
                }}
                searchValue={newCustomerSearch}
                onSearchChange={setNewCustomerSearch}
              />
            </div>

            {/* Product lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">
                  Products <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-slate-400">Total Qty: <span className="font-semibold text-slate-700">{totalQty}</span></span>
              </div>
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    {/* Product search */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search product…"
                        value={line.productLabel || line.productSearch}
                        onChange={(e) => {
                          updateLine(idx, 'productSearch', e.target.value);
                          updateLine(idx, 'productLabel', '');
                          updateLine(idx, 'productId', '');
                          void fetchProductsForLine(idx, e.target.value);
                        }}
                        className={inputCls}
                      />
                      {productSearches[idx]?.length > 0 && !line.productId && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {productSearches[idx].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-violet-50 text-slate-700"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                updateLine(idx, 'productId', p.id);
                                updateLine(idx, 'productLabel', `${p.name} (${p.sku}) — Stock: ${p.currentStock}`);
                                updateLine(idx, 'productSearch', '');
                                setProductSearches((ps) => { const c = [...ps]; c[idx] = []; return c; });
                              }}
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="text-slate-400 ml-1 text-xs">{p.sku}</span>
                              <span className="text-slate-400 ml-2 text-xs">Stock: {p.currentStock}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateLine(idx, 'quantity', e.target.value)}
                      className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Qty"
                    />

                    {/* Remove */}
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="px-2 py-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        title="Remove line"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-3 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors flex items-center gap-1"
              >
                + Add another product
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {formLoading ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Loading detail overlay ──────────────────────────────────────────── */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-xl px-8 py-6 flex items-center gap-3 shadow-lg">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-600">Loading challan…</span>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ────────────────────────────────────────────────────── */}
      {detailChallan && !detailLoading && (
        <Modal
          title={`Challan — ${detailChallan.challanNumber}`}
          onClose={() => { setDetailChallan(null); setActionError(null); }}
          width="max-w-2xl"
        >
          <div className="space-y-6">
            {/* Status + meta */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[detailChallan.status].cls}`}>
                {STATUS_BADGE[detailChallan.status].label}
              </span>
              <span className="text-xs text-slate-400">
                Created {new Date(detailChallan.createdAt).toLocaleString()}
                {detailChallan.user ? ` · by ${detailChallan.user.name}` : ''}
              </span>
            </div>

            {/* Insufficient stock error — must be prominent */}
            {actionError && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🚫</span>
                  <div>
                    <h4 className="font-semibold text-red-700 text-sm mb-1">Insufficient Stock — Confirmation Failed</h4>
                    {Array.isArray(actionError) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {(actionError as string[]).map((msg, i) => (
                          <li key={i} className="text-red-700 text-xs">{msg}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-red-700 text-xs">{actionError as string}</p>
                    )}
                    <p className="text-red-500 text-xs mt-2 font-medium">
                      No stock was deducted. The transaction was fully rolled back.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer info */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Customer</p>
              <p className="text-slate-800 font-medium">{detailChallan.customer?.name}</p>
              {detailChallan.customer?.businessName && (
                <p className="text-slate-500 text-sm">{detailChallan.customer.businessName}</p>
              )}
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-medium">
                  🔒 Prices locked at creation time
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Product', 'SKU', 'Unit Price', 'Qty', 'Line Total'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(detailChallan.challanItems as ChallanItem[] ?? []).map((item) => {
                      const price = parseFloat(item.unitPriceSnapshot);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-800">{item.productNameSnapshot}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{item.productSkuSnapshot}</td>
                          <td className="px-4 py-3 text-slate-700">₹{price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-700 font-semibold">{item.quantity}</td>
                          <td className="px-4 py-3 text-violet-700 font-semibold">₹{(price * item.quantity).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-400 font-medium">Total</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{detailChallan.totalQuantity}</td>
                      <td className="px-4 py-2.5 font-bold text-violet-700">
                        ₹{(detailChallan.challanItems as ChallanItem[] ?? []).reduce((sum, item) => sum + parseFloat(item.unitPriceSnapshot) * item.quantity, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            {canWrite && (
              <div className="pt-1">
                {detailChallan.status === 'DRAFT' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleConfirm()}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      {actionLoading ? '…' : '✓ Confirm Challan'}
                    </button>
                    <button
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      ✕ Cancel Draft
                    </button>
                  </div>
                )}

                {detailChallan.status === 'CONFIRMED' && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      ↩ Cancel & Restore Stock
                    </button>
                    <p className="text-xs text-slate-400">Cancelling will restore {detailChallan.totalQuantity} units to inventory.</p>
                  </div>
                )}

                {detailChallan.status === 'CANCELLED' && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>🚫</span>
                    <span>This challan was cancelled. No further actions available.</span>
                  </div>
                )}
              </div>
            )}

            {/* Read-only notice for WAREHOUSE/ACCOUNTS */}
            {!canWrite && (
              <p className="text-xs text-slate-400 italic">You have read-only access to challans.</p>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Cancel confirmation modal ───────────────────────────────────────── */}
      {cancelConfirmOpen && detailChallan && (
        <Modal title="Confirm Cancellation" onClose={() => setCancelConfirmOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to cancel challan{' '}
              <span className="font-mono font-semibold">{detailChallan.challanNumber}</span>?
            </p>
            {detailChallan.status === 'CONFIRMED' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
                ⚠ This challan is <strong>CONFIRMED</strong>. Cancelling will restore{' '}
                <strong>{detailChallan.totalQuantity} units</strong> of inventory back to stock.
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setCancelConfirmOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Keep It
              </button>
              <button
                onClick={() => void handleCancel()}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Yes, Cancel Challan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
