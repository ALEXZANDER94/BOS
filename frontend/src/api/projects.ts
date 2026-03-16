import axios from 'axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Address {
  id:       number
  address1: string
  address2: string
  city:     string
  state:    string
  zip:      string
  country:  string
}

export interface Lot {
  id:          number
  buildingId:  number
  name:        string
  description: string
  address:     Address | null
}

export interface Building {
  id:          number
  projectId:   number
  name:        string
  description: string
  lots:        Lot[]
}

export interface PurchaseOrderStatus {
  id:    number
  name:  string
  color: string
}

export interface PurchaseOrder {
  id:                  number
  projectId:           number
  lotId:               number
  lotName:             string
  buildingName:        string
  orderNumber:         string
  invoiceNumber:       string | null
  amount:              number
  qbStatus:            string
  internalStatusId:    number | null
  internalStatusName:  string | null
  internalStatusColor: string | null
  createdAt:           string
  updatedAt:           string
}

export interface AssignedContact {
  id:    number
  name:  string
  email: string
  phone: string
  title: string
}

export interface ProjectDetail {
  id:                 number
  clientId:           number
  clientName:         string
  name:               string
  description:        string
  status:             string
  startDate:          string | null
  endDate:            string | null
  createdAt:          string
  updatedAt:          string
  buildingCount:      number
  lotCount:           number
  purchaseOrderCount: number
  totalPoAmount:      number
  assignedContacts:   AssignedContact[]
}

export interface QuickBooksStatus {
  connected: boolean
  realmId:   string | null
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateBuildingRequest { name: string; description: string }
export interface UpdateBuildingRequest { name: string; description: string }

export interface CreateLotRequest { name: string; description: string }
export interface UpdateLotRequest { name: string; description: string }

export interface UpsertAddressRequest {
  address1: string
  address2: string
  city:     string
  state:    string
  zip:      string
  country:  string
}

export interface CreatePurchaseOrderRequest { lotId: number; orderNumber: string; amount: number }
export interface UpdatePurchaseOrderRequest { orderNumber: string; amount: number }

export interface PoCsvRowError {
  rowNumber:   number
  orderNumber: string
  reason:      string
}

export interface PoCsvImportResult {
  importedCount:    number
  skippedCount:     number
  errorCount:       number
  buildingsCreated: number
  lotsCreated:      number
  errors:           PoCsvRowError[]
}

// ── API objects ───────────────────────────────────────────────────────────────

export const projectDetailApi = {
  getById: (id: number) =>
    axios.get<ProjectDetail>(`/api/project/${id}`).then(r => r.data),
}

export const buildingApi = {
  getAll: (projectId: number) =>
    axios.get<Building[]>(`/api/project/${projectId}/building`).then(r => r.data),

  create: (projectId: number, data: CreateBuildingRequest) =>
    axios.post<Building>(`/api/project/${projectId}/building`, data).then(r => r.data),

  update: (projectId: number, buildingId: number, data: UpdateBuildingRequest) =>
    axios.put<Building>(`/api/project/${projectId}/building/${buildingId}`, data).then(r => r.data),

  delete: (projectId: number, buildingId: number) =>
    axios.delete(`/api/project/${projectId}/building/${buildingId}`),
}

export const lotApi = {
  create: (buildingId: number, data: CreateLotRequest) =>
    axios.post<Lot>(`/api/building/${buildingId}/lot`, data).then(r => r.data),

  update: (buildingId: number, lotId: number, data: UpdateLotRequest) =>
    axios.put<Lot>(`/api/building/${buildingId}/lot/${lotId}`, data).then(r => r.data),

  delete: (buildingId: number, lotId: number) =>
    axios.delete(`/api/building/${buildingId}/lot/${lotId}`),

  upsertAddress: (buildingId: number, lotId: number, data: UpsertAddressRequest) =>
    axios.put<Lot>(`/api/building/${buildingId}/lot/${lotId}/address`, data).then(r => r.data),

  deleteAddress: (buildingId: number, lotId: number) =>
    axios.delete(`/api/building/${buildingId}/lot/${lotId}/address`),
}

export const purchaseOrderApi = {
  getAll: (projectId: number) =>
    axios.get<PurchaseOrder[]>(`/api/project/${projectId}/purchase-order`).then(r => r.data),

  create: (projectId: number, data: CreatePurchaseOrderRequest) =>
    axios.post<PurchaseOrder>(`/api/project/${projectId}/purchase-order`, data).then(r => r.data),

  update: (projectId: number, poId: number, data: UpdatePurchaseOrderRequest) =>
    axios.put<PurchaseOrder>(`/api/project/${projectId}/purchase-order/${poId}`, data).then(r => r.data),

  delete: (projectId: number, poId: number) =>
    axios.delete(`/api/project/${projectId}/purchase-order/${poId}`),

  syncOne: (projectId: number, poId: number) =>
    axios.post<PurchaseOrder>(`/api/project/${projectId}/purchase-order/${poId}/sync`).then(r => r.data),

  syncAll: (projectId: number) =>
    axios.post<PurchaseOrder[]>(`/api/project/${projectId}/purchase-order/sync-all`).then(r => r.data),

  importFromCsv: (projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post<PoCsvImportResult>(
      `/api/project/${projectId}/purchase-order/import`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
}

export const purchaseOrderStatusApi = {
  getAll: () =>
    axios.get<PurchaseOrderStatus[]>('/api/purchase-order-statuses').then(r => r.data),

  create: (data: { name: string; color: string }) =>
    axios.post<PurchaseOrderStatus>('/api/purchase-order-statuses', data).then(r => r.data),

  update: (id: number, data: { name: string; color: string }) =>
    axios.put<PurchaseOrderStatus>(`/api/purchase-order-statuses/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`/api/purchase-order-statuses/${id}`),

  patchOnPo: (projectId: number, poId: number, statusId: number | null) =>
    axios.patch<PurchaseOrder>(
      `/api/project/${projectId}/purchase-order/${poId}/internal-status`,
      { statusId }
    ).then(r => r.data),
}

export interface ProjectCsvRowError {
  rowNumber:   number
  projectName: string
  reason:      string
}

export interface ProjectCsvImportResult {
  importedCount: number
  skippedCount:  number
  errorCount:    number
  errors:        ProjectCsvRowError[]
}

export const allProjectsApi = {
  importFromCsv: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post<ProjectCsvImportResult>(
      '/api/project/import',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
}

export const quickBooksApi = {
  getStatus: () =>
    axios.get<QuickBooksStatus>('/api/quickbooks/status').then(r => r.data),

  disconnect: () =>
    axios.delete('/api/quickbooks/disconnect'),
}
