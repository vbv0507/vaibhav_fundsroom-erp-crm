

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
  imageUrl: string | null;
  createdAt: string;
  stockMovements?: StockMovement[];
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface ChallanItem {
  id: string;
  challanId: string;
  productId: string;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  unitPriceSnapshot: string;
  quantity: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  status: ChallanStatus;
  totalQuantity: number;
  createdBy: string;
  createdAt: string;
  customer?: { id: string; name: string; businessName: string | null };
  user?: { id: string; name: string; role: string };
  challanItems?: ChallanItem[];
}

export type UserRole = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}
