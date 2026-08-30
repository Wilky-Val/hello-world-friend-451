export type Product = {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  stock_qty: number;
  cost_price: number;
  sale_price: number;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  label: string;
  category: string;
  amount: number;
  spent_at: string;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  ticket_no: number;
  total: number;
  cost_total: number;
  paid: number;
  change_due: number;
  customer: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
};

export type CartLine = {
  product: Product;
  qty: number;
};

export const CURRENCY = "HTG";

export function formatMoney(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${CURRENCY}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty * Number(l.product.sale_price), 0);
}

export function cartCost(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty * Number(l.product.cost_price), 0);
}
