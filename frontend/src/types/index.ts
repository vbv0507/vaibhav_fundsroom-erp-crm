// ──────────────────────────────────────────────
// Shared domain types matching the Prisma schema
// ──────────────────────────────────────────────

export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';

export interface CustomerNote {
  id: string;
  text: string;
  customerId: string;
  createdBy: string;
  createdAt: string;
  user: { name: string; role: string };
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string | null;
  gstNumber: string | null;
  customerType: CustomerType;
  address: string | null;
  status: CustomerStatus;
  followUpDate: string | null;
  createdAt: string;
  notes?: CustomerNote[];
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  productId: string;
  quantityChanged: number;
  movementType: MovementType;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  user: { name: string; role: string };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
  location: string | null;
  createdAt: string;
  stockMovements?: StockMovement[];
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
