import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';

type UserRole = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

const ROLES: UserRole[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];

const ROLE_BADGE: Record<UserRole, { cls: string; desc: string }> = {
  ADMIN: { cls: 'bg-violet-100 text-violet-700', desc: 'Full access' },
  SALES: { cls: 'bg-blue-100 text-blue-700', desc: 'Customers & Challans' },
  WAREHOUSE: { cls: 'bg-amber-100 text-amber-700', desc: 'Products & Stock' },
  ACCOUNTS: { cls: 'bg-emerald-100 text-emerald-700', desc: 'View only' },
};

const EMPTY_FORM: UserForm = { name: '', email: '', role: 'SALES', password: '' };

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400';

const selectCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white';

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users');
      setUsers(res.data.data as AppUser[]);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const openEdit = (u: AppUser) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setFormError('');
    setEditUser(u);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (editUser) {
        const payload: Partial<UserForm> = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser.id}`, payload);
        setEditUser(null);
      } else {
        await api.post('/users', form);
        setShowAddModal(false);
      }
      void fetchUsers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error ?? 'An error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/users/${deleteUser.id}`);
      setDeleteUser(null);
      void fetchUsers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error ?? 'Delete failed.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage system users and their roles</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span>+</span> Add User
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.map((role) => (
          <div key={role} className={`rounded-xl border px-4 py-3 ${ROLE_BADGE[role].cls} border-opacity-30`}>
            <p className="text-xs font-bold uppercase tracking-wide">{role}</p>
            <p className="text-xs mt-0.5 opacity-70">{ROLE_BADGE[role].desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="flex gap-2 items-center text-sm">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Loading users…
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-red-500">
            <p className="text-sm">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-sm font-medium text-slate-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Email', 'Role', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role].cls}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 py-1 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteUser(u)}
                          className="px-3 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <Modal title="Add New User" onClose={() => setShowAddModal(false)}>
          <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} required className={inputCls} placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-red-400">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required className={inputCls} placeholder="user@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role <span className="text-red-400">*</span></label>
                <select name="role" value={form.role} onChange={handleSelect} className={selectCls}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password <span className="text-red-400">*</span></label>
                <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} className={inputCls} placeholder="Min 6 characters" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                ⚠ {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-red-400">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role <span className="text-red-400">*</span></label>
                <select name="role" value={form.role} onChange={handleSelect} className={selectCls}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New Password <span className="text-slate-400 font-normal">(leave blank to keep)</span></label>
                <input name="password" type="password" value={form.password} onChange={handleChange} minLength={6} className={inputCls} placeholder="Leave blank to keep current" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 transition-colors">
                {formLoading ? 'Saving…' : 'Update User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteUser && (
        <Modal title="Delete User" onClose={() => setDeleteUser(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete <span className="font-semibold">{deleteUser.name}</span> ({deleteUser.email})?
            </p>
            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
              ⚠ This action cannot be undone.
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Keep
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
