import axios from 'axios'

// ---------------------------------------------------------------------------
// Types — mirror the C# DTOs exactly.
// ---------------------------------------------------------------------------

export interface ComparisonCriteria {
  id: number
  supplierId: number
  matchColumn: string
  format: string
  colPrice: string
  /** Optional manual X-anchor override for the match column (PDF points). Null = auto-detect. */
  matchColX: number | null
  /** Optional manual X-anchor override for the price column (PDF points). Null = auto-detect. */
  priceColX: number | null
  /**
   * Optional separate Description column header.
   * When set, the parser reads this column directly instead of extracting description
   * from the combined match-key cell. MFR is always parsed from the Format template.
   */
  colDescription: string | null
  /**
   * Optional Quantity column header.
   * Number of units on each invoice line; used together with colTotal for total-based comparison.
   */
  colQuantity: string | null
  /**
   * Optional Total column header.
   * When set, comparison uses: expectedTotal = masterPricePerUnit × Quantity,
   * compared against this column's value.
   */
  colTotal: string | null
  /**
   * Optional Invoice Number column header.
   * When set, the invoice number is shown in comparison results and the PDF report.
   */
  colInvoiceNumber: string | null
  createdAt: string
  updatedAt: string
}

export interface UpsertComparisonCriteriaRequest {
  matchColumn: string
  format: string
  colPrice: string
  /** Optional manual X-anchor (PDF points). Omit or pass null to use auto-detect. */
  matchColX?: number | null
  /** Optional manual X-anchor (PDF points). Omit or pass null to use auto-detect. */
  priceColX?: number | null
  /** Optional separate Description column header. */
  colDescription?: string | null
  /** Optional Quantity column header. */
  colQuantity?: string | null
  /** Optional Total column header. */
  colTotal?: string | null
  /** Optional Invoice Number column header. */
  colInvoiceNumber?: string | null
}

export interface Supplier {
  id: number
  name: string
  domain: string
  website: string
  createdAt: string
  updatedAt: string
  criteria?: ComparisonCriteria | null
}

export interface CreateSupplierRequest {
  name: string
  domain: string
  website: string
}

export type UpdateSupplierRequest = CreateSupplierRequest

// ---------------------------------------------------------------------------
// API functions — thin wrappers around axios that return typed data.
// These are consumed by the React Query hooks in hooks/useSuppliers.ts.
// ---------------------------------------------------------------------------

const BASE = '/api/supplier'

export const supplierApi = {
  getAll: () =>
    axios.get<Supplier[]>(BASE).then(r => r.data),

  getById: (id: number) =>
    axios.get<Supplier>(`${BASE}/${id}`).then(r => r.data),

  create: (data: CreateSupplierRequest) =>
    axios.post<Supplier>(BASE, data).then(r => r.data),

  update: (id: number, data: UpdateSupplierRequest) =>
    axios.put<Supplier>(`${BASE}/${id}`, data).then(r => r.data),

  delete: (id: number) => axios.delete(`${BASE}/${id}`),

  getCriteria: (supplierId: number) =>
    axios.get<ComparisonCriteria>(`${BASE}/${supplierId}/criteria`).then(r => r.data),

  upsertCriteria: (supplierId: number, data: UpsertComparisonCriteriaRequest) =>
    axios.put<ComparisonCriteria>(`${BASE}/${supplierId}/criteria`, data).then(r => r.data),
}
