import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useDebounce } from '../hooks/useDebounce';
import type { Customer, CustomerType, CustomerStatus, CustomerNote, PaginatedMeta } from '../types';

const CUSTOMER_TYPES: CustomerType[] = ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['LEAD', 'ACTIVE', 'INACTIVE'];

const STATUS_BADGE: Record<CustomerStatus, string> = {
  LEAD: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
};

const TYPE_BADGE: Record<CustomerType, string> = {
  RETAIL: 'bg-blue-50 text-blue-700',
  WHOLESALE: 'bg-violet-50 text-violet-700',
  DISTRIBUTOR: 'bg-cyan-50 text-cyan-700',
};

interface CustomerForm {
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string;
  customerType: CustomerType;
  address: string;
  status: CustomerStatus;
  followUpDate: string;
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  mobile: '',
  email: '',
  businessName: '',
  gstNumber: '',
  customerType: 'RETAIL',
  address: '',
  status: 'LEAD',
  followUpDate: '',
};

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

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-slate-400 disabled:bg-slate-50';

const selectCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white';

function CustomerFormContent({
  form,
  onChange,
  onSelect,
}: {
  form: CustomerForm;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelect: (e: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" id="name" required>
          <input id="name" name="name" value={form.name} onChange={onChange} className={inputCls} placeholder="Full name" />
        </FormField>
        <FormField label="Mobile" id="mobile" required>
          <input id="mobile" name="mobile" value={form.mobile} onChange={onChange} className={inputCls} placeholder="+91..." />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email" id="email">
          <input id="email" name="email" type="email" value={form.email} onChange={onChange} className={inputCls} placeholder="email@example.com" />
        </FormField>
        <FormField label="Business Name" id="businessName" required>
          <input id="businessName" name="businessName" value={form.businessName} onChange={onChange} className={inputCls} placeholder="Company / Shop name" />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="GST Number" id="gstNumber">
          <input id="gstNumber" name="gstNumber" value={form.gstNumber} onChange={onChange} className={inputCls} placeholder="Optional" />
        </FormField>
        <FormField label="Customer Type" id="customerType" required>
          <select id="customerType" name="customerType" value={form.customerType} onChange={onSelect} className={selectCls}>
            {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Address" id="address" required>
        <textarea id="address" name="address" value={form.address} onChange={onChange} rows={2} className={inputCls} placeholder="Full address" />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Status" id="status">
          <select id="status" name="status" value={form.status} onChange={onSelect} className={selectCls}>
            {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Follow-up Date" id="followUpDate">
          <input id="followUpDate" name="followUpDate" type="date" value={form.followUpDate} onChange={onChange} className={inputCls} />
        </FormField>
      </div>
    </div>
  );
}

export default function Customers() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'SALES';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('');

  useDebounce(search, 350, setDebouncedSearch);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await api.get(`/customers?${params}`);
      setCustomers(res.data.data);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  const openDetail = async (c: Customer) => {
    const res = await api.get(`/customers/${c.id}`);
    setDetailCustomer(res.data.data as Customer);
    setNoteText('');
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowAddModal(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name,
      mobile: c.mobile,
      email: c.email ?? '',
      businessName: c.businessName ?? '',
      gstNumber: c.gstNumber ?? '',
      customerType: c.customerType,
      address: c.address ?? '',
      status: c.status,
      followUpDate: c.followUpDate ? c.followUpDate.split('T')[0] : '',
    });
    setFormError('');
    setEditCustomer(c);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        gstNumber: form.gstNumber || undefined,
        followUpDate: form.followUpDate || undefined,
      };
      if (editCustomer) {
        await api.put(`/customers/${editCustomer.id}`, payload);
        setEditCustomer(null);
      } else {
        await api.post('/customers', payload);
        setShowAddModal(false);
      }
      void fetchCustomers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error ?? 'An error occurred. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailCustomer || !noteText.trim()) return;
    setNoteLoading(true);
    try {
      await api.post(`/customers/${detailCustomer.id}/notes`, { text: noteText });
      const res = await api.get(`/customers/${detailCustomer.id}`);
      setDetailCustomer(res.data.data as Customer);
      setNoteText('');
    } finally {
      setNoteLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Customers</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meta.total} total customers</p>
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> Add Customer
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, mobile, business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-52 px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
          className={selectCls + ' w-36'}
        >
          <option value="">All Status</option>
          {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CustomerType | '')}
          className={selectCls + ' w-40'}
        >
          <option value="">All Types</option>
          {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="flex gap-2 items-center text-sm">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Loading customers…
            </div>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm font-medium text-slate-500">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Mobile', 'Business', 'Type', 'Status', 'Follow-up'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => void openDetail(c)}
                    className="hover:bg-violet-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800">{c.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.mobile}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.businessName ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_BADGE[c.customerType]}`}>
                        {c.customerType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
            <span>Page {meta.page} of {meta.totalPages} ({meta.total} records)</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors text-xs"
              >
                ← Prev
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors text-xs"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <Modal title="Add Customer" onClose={() => setShowAddModal(false)}>
          <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {formError}
              </div>
            )}
            <CustomerFormContent form={form} onChange={handleChange} onSelect={handleSelect} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Saving…' : 'Save Customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editCustomer && (
        <Modal title={`Edit — ${editCustomer.name}`} onClose={() => setEditCustomer(null)}>
          <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {formError}
              </div>
            )}
            <CustomerFormContent form={form} onChange={handleChange} onSelect={handleSelect} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditCustomer(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Saving…' : 'Update Customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailCustomer && (
        <Modal title={detailCustomer.name} onClose={() => setDetailCustomer(null)} width="max-w-2xl">
          <div className="space-y-5">
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Mobile', detailCustomer.mobile],
                ['Email', detailCustomer.email ?? '—'],
                ['Business', detailCustomer.businessName ?? '—'],
                ['GST Number', detailCustomer.gstNumber ?? '—'],
                ['Type', detailCustomer.customerType],
                ['Address', detailCustomer.address ?? '—'],
                ['Status', detailCustomer.status],
                ['Follow-up', detailCustomer.followUpDate ? new Date(detailCustomer.followUpDate).toLocaleDateString() : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className="text-slate-700 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {canWrite && (
              <button
                onClick={() => { openEdit(detailCustomer); setDetailCustomer(null); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ✏ Edit Customer
              </button>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes History</h3>
              {(detailCustomer.notes ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No notes yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(detailCustomer.notes as CustomerNote[]).map((n) => (
                    <div key={n.id} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                      <p className="text-sm text-slate-700">{n.text}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {n.user.name} ({n.user.role}) · {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {canWrite && (
                <form onSubmit={(e) => void submitNote(e)} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a follow-up note…"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={noteLoading || !noteText.trim()}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {noteLoading ? '…' : 'Add'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
