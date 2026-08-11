import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useDebounce } from '../hooks/useDebounce';
import type { Product, StockMovement, MovementType, PaginatedMeta } from '../types';

const MOVEMENT_BADGE: Record<MovementType, string> = {
  IN: 'bg-emerald-100 text-emerald-700',
  OUT: 'bg-red-100 text-red-700',
};

interface ProductForm {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: string;
  minStockAlert: string;
  location: string;
}

interface MovementForm {
  quantityChanged: string;
  movementType: MovementType;
  reason: string;
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  sku: '',
  category: '',
  unitPrice: '',
  currentStock: '0',
  minStockAlert: '',
  location: '',
};

const EMPTY_MOVEMENT_FORM: MovementForm = {
  quantityChanged: '',
  movementType: 'IN',
  reason: '',
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400';

function FormField({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function ProductFormContent({
  form,
  onChange,
  isEdit,
}: {
  form: ProductForm;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Product Name" id="name" required>
          <input id="name" name="name" value={form.name} onChange={onChange} className={inputCls} placeholder="Product name" />
        </FormField>
        <FormField label="SKU" id="sku" required>
          <input id="sku" name="sku" value={form.sku} onChange={onChange} className={inputCls} placeholder="e.g. WM-001" disabled={isEdit} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" id="category" required>
          <input id="category" name="category" value={form.category} onChange={onChange} className={inputCls} placeholder="e.g. Electronics" />
        </FormField>
        <FormField label="Unit Price (₹)" id="unitPrice" required>
          <input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0.01" value={form.unitPrice} onChange={onChange} className={inputCls} placeholder="0.00" />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {!isEdit && (
          <FormField label="Initial Stock" id="currentStock">
            <input id="currentStock" name="currentStock" type="number" min="0" value={form.currentStock} onChange={onChange} className={inputCls} />
          </FormField>
        )}
        <FormField label="Min Stock Alert" id="minStockAlert" required>
          <input id="minStockAlert" name="minStockAlert" type="number" min="0" value={form.minStockAlert} onChange={onChange} className={inputCls} placeholder="Alert threshold" />
        </FormField>
        <FormField label="Location" id="location" required>
          <input id="location" name="location" value={form.location} onChange={onChange} className={inputCls} placeholder="e.g. Aisle 3" />
        </FormField>
      </div>
      {isEdit && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ Current stock cannot be changed here. Use "Record Stock Movement" to adjust inventory levels.
        </p>
      )}
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE';

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useDebounce(search, 350, setDebouncedSearch);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementForm, setMovementForm] = useState<MovementForm>(EMPTY_MOVEMENT_FORM);
  const [movementError, setMovementError] = useState('');
  const [movementLoading, setMovementLoading] = useState(false);

  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (categoryFilter) params.set('category', categoryFilter);
      if (lowStockOnly) params.set('lowStock', 'true');

      const res = await api.get(`/products?${params}`);
      setProducts(res.data.data);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, lowStockOnly]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, lowStockOnly]);

  const openDetail = async (p: Product) => {
    const res = await api.get(`/products/${p.id}`);
    setDetailProduct(res.data.data as Product);
    setMovementForm(EMPTY_MOVEMENT_FORM);
    setMovementError('');
  };

  const handleProductChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProductForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const openAdd = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setFormError('');
    setShowAddModal(true);
  };

  const openEdit = (p: Product) => {
    setProductForm({
      name: p.name,
      sku: p.sku,
      category: p.category ?? '',
      unitPrice: p.unitPrice,
      currentStock: String(p.currentStock),
      minStockAlert: String(p.minStockAlert),
      location: p.location ?? '',
    });
    setFormError('');
    setEditProduct(p);
  };

  const submitProductForm = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        category: productForm.category,
        unitPrice: parseFloat(productForm.unitPrice),
        currentStock: parseInt(productForm.currentStock),
        minStockAlert: parseInt(productForm.minStockAlert),
        location: productForm.location,
      };
      if (editProduct) {

        const { currentStock: _cs, ...editPayload } = payload;
        void _cs;
        await api.put(`/products/${editProduct.id}`, editPayload);
        setEditProduct(null);
      } else {
        await api.post('/products', payload);
        setShowAddModal(false);
      }
      void fetchProducts();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error ?? 'An error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const submitMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailProduct) return;
    setMovementLoading(true);
    setMovementError('');
    try {
      await api.post(`/products/${detailProduct.id}/stock-movement`, {
        quantityChanged: parseInt(movementForm.quantityChanged),
        movementType: movementForm.movementType,
        reason: movementForm.reason || undefined,
      });

      const res = await api.get(`/products/${detailProduct.id}`);
      setDetailProduct(res.data.data as Product);
      setMovementForm(EMPTY_MOVEMENT_FORM);
      setShowMovementModal(false);
      void fetchProducts();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMovementError(ax.response?.data?.error ?? 'Failed to record movement.');
    } finally {
      setMovementLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Products</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meta.total} total products</p>
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> Add Product
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 placeholder-slate-400"
        />
        <input
          type="text"
          placeholder="Filter by category…"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-44 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 placeholder-slate-400"
        />
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors select-none text-sm text-slate-700">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="accent-violet-600 w-4 h-4"
          />
          Low Stock Only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="flex gap-2 items-center text-sm">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Loading products…
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-sm font-medium text-slate-500">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'SKU', 'Category', 'Unit Price', 'Stock', 'Location'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => void openDetail(p)}
                      className={`hover:bg-violet-50 cursor-pointer transition-colors ${isLow ? 'bg-red-50/60' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-800">
                        {p.name}
                        {isLow && (
                          <span className="ml-2 text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{p.sku}</td>
                      <td className="px-5 py-3.5 text-slate-600">{p.category ?? '—'}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">₹{parseFloat(p.unitPrice).toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                          {p.currentStock}
                        </span>
                        <span className="text-slate-400 text-xs"> / {p.minStockAlert} min</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{p.location ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

      {showAddModal && (
        <Modal title="Add Product" onClose={() => setShowAddModal(false)}>
          <form onSubmit={(e) => void submitProductForm(e)} className="space-y-4">
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">⚠ {formError}</div>}
            <ProductFormContent form={productForm} onChange={handleProductChange} isEdit={false} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editProduct && (
        <Modal title={`Edit — ${editProduct.name}`} onClose={() => setEditProduct(null)}>
          <form onSubmit={(e) => void submitProductForm(e)} className="space-y-4">
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">⚠ {formError}</div>}
            <ProductFormContent form={productForm} onChange={handleProductChange} isEdit={true} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditProduct(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Saving…' : 'Update Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailProduct && (
        <Modal title={detailProduct.name} onClose={() => setDetailProduct(null)} width="max-w-2xl">
          <div className="space-y-5">
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['SKU', detailProduct.sku],
                ['Category', detailProduct.category ?? '—'],
                ['Unit Price', `₹${parseFloat(detailProduct.unitPrice).toFixed(2)}`],
                ['Location', detailProduct.location ?? '—'],
                ['Current Stock', String(detailProduct.currentStock)],
                ['Min Alert', String(detailProduct.minStockAlert)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className={`mt-0.5 font-medium ${k === 'Current Stock' && detailProduct.currentStock <= detailProduct.minStockAlert ? 'text-red-600' : 'text-slate-700'}`}>{v}</p>
                </div>
              ))}
            </div>

            {canWrite && (
              <div className="flex gap-2">
                <button onClick={() => { openEdit(detailProduct); setDetailProduct(null); }} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                  ✏ Edit Product
                </button>
                <button
                  onClick={() => { setShowMovementModal(true); setMovementError(''); setMovementForm(EMPTY_MOVEMENT_FORM); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
                >
                  📦 Record Movement
                </button>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Stock Movements</h3>
              {(detailProduct.stockMovements ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Type', 'Qty', 'Reason', 'By', 'Date'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailProduct.stockMovements as StockMovement[]).map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${MOVEMENT_BADGE[m.movementType]}`}>
                              {m.movementType}
                            </span>
                          </td>
                          <td className={`px-3 py-2 font-semibold ${m.movementType === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {m.movementType === 'IN' ? '+' : '−'}{m.quantityChanged}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{m.reason ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{m.user.name}</td>
                          <td className="px-3 py-2 text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {detailProduct && showMovementModal && (
        <Modal title="Record Stock Movement" onClose={() => setShowMovementModal(false)}>
          <form onSubmit={(e) => void submitMovement(e)} className="space-y-4">
            {movementError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {movementError}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Current stock for <span className="font-medium text-slate-700">{detailProduct.name}</span>:{' '}
              <span className="font-semibold text-slate-800">{detailProduct.currentStock}</span> units
            </p>

            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Movement Type</p>
              <div className="flex gap-2">
                {(['IN', 'OUT'] as MovementType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMovementForm((f) => ({ ...f, movementType: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      movementForm.movementType === t
                        ? t === 'IN'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-red-600 text-white border-red-600'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'IN' ? '↑ IN' : '↓ OUT'}
                  </button>
                ))}
              </div>
            </div>

            <FormField label="Quantity" id="qtyChanged" required>
              <input
                id="qtyChanged"
                name="quantityChanged"
                type="number"
                min="1"
                value={movementForm.quantityChanged}
                onChange={(e) => setMovementForm((f) => ({ ...f, quantityChanged: e.target.value }))}
                className={inputCls}
                placeholder="Enter quantity"
              />
            </FormField>

            <FormField label="Reason" id="reason">
              <input
                id="reason"
                name="reason"
                value={movementForm.reason}
                onChange={(e) => setMovementForm((f) => ({ ...f, reason: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Supplier delivery, Customer order"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowMovementModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={movementLoading || !movementForm.quantityChanged}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {movementLoading ? 'Recording…' : 'Record Movement'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
