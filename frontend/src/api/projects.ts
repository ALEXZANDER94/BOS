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

export interface Plan {
  id:            number
  buildingId:    number
  planName:      string
  squareFootage: number
  amount:        number
}

export interface Lot {
  id:          number
  buildingId:  number
  name:        string
  description: string
  planId:      number | null
  planName:    string | null
  address:     Address | null
}

export interface Building {
  id:          number
  projectId:   number
  name:        string
  description: string
  lots:        Lot[]
  plans:       Plan[]
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

export interface ProjectUpgradeState {
  customUpgradeId: number
  name:            string
  description:     string
  isGlobal:        boolean
  isEnabled:       boolean
}

export interface ProjectDetail {
  id:                   number
  clientId:             number
  clientName:           string
  name:                 string
  description:          string
  status:               string
  startDate:            string | null
  endDate:              string | null
  createdAt:            string
  updatedAt:            string
  buildingCount:        number
  lotCount:             number
  purchaseOrderCount:   number
  totalPoAmount:        number
  assignedContacts:     AssignedContact[]
  // Carried over from a converted Proposal (null/empty otherwise)
  sourceProposalId:     number | null
  sourceLibraryId:      number | null
  sourceLibraryTitle:   string | null
  address:              string
  city:                 string
  productStandards:     string
  version:              string
  buyerUpgrades:        string
  revisionsAfterLaunch: string
  customUpgrades:       ProjectUpgradeState[]
  // QuickBooks Project (sub-customer) link — when set, the Estimates tab
  // scopes its QB queries to this sub-customer instead of the parent client.
  qbProjectId:          string | null
  qbProjectName:        string | null
}

export interface QuickBooksStatus {
  connected: boolean
  realmId:   string | null
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateBuildingRequest { name: string; description: string }
export interface UpdateBuildingRequest { name: string; description: string }

export interface CreateLotRequest { name: string; description: string; planId: number | null }
export interface UpdateLotRequest { name: string; description: string; planId: number | null }

export interface CreatePlanRequest { planName: string; squareFootage: number; amount: number }
export interface UpdatePlanRequest { planName: string; squareFootage: number; amount: number }

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

export interface PoCsvConflict {
  rowNumber:      number
  orderNumber:    string
  existingLot:    string
  proposedLot:    string
  existingAmount: number
  proposedAmount: number
}

export interface PoCsvImportResult {
  importedCount:    number
  updatedCount:     number
  skippedCount:     number
  errorCount:       number
  buildingsCreated: number
  lotsCreated:      number
  errors:           PoCsvRowError[]
  conflicts:        PoCsvConflict[]
}

// ── API objects ───────────────────────────────────────────────────────────────

export interface UpdateProjectRequest {
  name:        string
  description: string
  status:      string
  startDate:   string | null
  endDate:     string | null
}

export const projectDetailApi = {
  getById: (id: number) =>
    axios.get<ProjectDetail>(`/api/project/${id}`).then(r => r.data),

  update: (clientId: number, id: number, data: UpdateProjectRequest) =>
    axios.put<ProjectDetail>(`/api/client/${clientId}/project/${id}`, data).then(r => r.data),
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

  reorder: (projectId: number, orderedIds: number[]) =>
    axios.put(`/api/project/${projectId}/building/reorder`, { orderedIds }),
}

export const planApi = {
  getAll: (buildingId: number) =>
    axios.get<Plan[]>(`/api/building/${buildingId}/plan`).then(r => r.data),

  create: (buildingId: number, data: CreatePlanRequest) =>
    axios.post<Plan>(`/api/building/${buildingId}/plan`, data).then(r => r.data),

  update: (buildingId: number, planId: number, data: UpdatePlanRequest) =>
    axios.put<Plan>(`/api/building/${buildingId}/plan/${planId}`, data).then(r => r.data),

  delete: (buildingId: number, planId: number) =>
    axios.delete(`/api/building/${buildingId}/plan/${planId}`),
}

export const lotApi = {
  create: (buildingId: number, data: CreateLotRequest) =>
    axios.post<Lot>(`/api/building/${buildingId}/lot`, data).then(r => r.data),

  update: (buildingId: number, lotId: number, data: UpdateLotRequest) =>
    axios.put<Lot>(`/api/building/${buildingId}/lot/${lotId}`, data).then(r => r.data),

  delete: (buildingId: number, lotId: number) =>
    axios.delete(`/api/building/${buildingId}/lot/${lotId}`),

  reorder: (buildingId: number, orderedIds: number[]) =>
    axios.put(`/api/building/${buildingId}/lot/reorder`, { orderedIds }),

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

  importFromCsv: (projectId: number, file: File, overrideOrderNumbers?: string[]) => {
    const fd = new FormData()
    fd.append('file', file)
    if (overrideOrderNumbers && overrideOrderNumbers.length > 0)
      fd.append('overrideOrderNumbers', overrideOrderNumbers.join(','))
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

export interface BuildingLotCsvRowError {
  rowNumber:    number
  buildingName: string
  lotName:      string
  reason:       string
}

export interface BuildingLotCsvImportResult {
  buildingsCreated:  number
  buildingsExisting: number
  lotsCreated:       number
  lotsExisting:      number
  addressesSet:      number
  errorCount:        number
  errors:            BuildingLotCsvRowError[]
}

export const buildingLotImportApi = {
  importFromCsv: (projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post<BuildingLotCsvImportResult>(
      `/api/project/${projectId}/building/import`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
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

export interface QbCustomer {
  id:          string
  displayName: string
}

export interface QuickBooksAppSettings {
  projectCustomFieldName: string | null
}

export const quickBooksApi = {
  getStatus: () =>
    axios.get<QuickBooksStatus>('/api/quickbooks/status').then(r => r.data),

  disconnect: () =>
    axios.delete('/api/quickbooks/disconnect'),

  listCustomers: () =>
    axios.get<QbCustomer[]>('/api/quickbooks/customers').then(r => r.data),

  getAppSettings: () =>
    axios.get<QuickBooksAppSettings>('/api/settings/quickbooks').then(r => r.data),

  updateAppSettings: (data: QuickBooksAppSettings) =>
    axios.put<QuickBooksAppSettings>('/api/settings/quickbooks', data).then(r => r.data),
}

// ── QuickBooks Estimates / Invoices ───────────────────────────────────────────

export interface QbLine {
  lineNum:     number | null
  description: string
  qty:         number
  rate:        number
  amount:      number
  itemId:      string | null
  itemName:    string | null
}

export interface QbCustomField {
  name:  string
  value: string | null
}

// LinkSource: '' = not linked (available);
//             'custom-field' = auto-linked via the configured QB Custom Field (Approach A);
//             'explicit'     = manually linked via ProjectQb*Link table (Approach B).
export type QbLinkSource = '' | 'custom-field' | 'explicit'

export interface QbDocument {
  id:                   string
  docType:              'Estimate' | 'Invoice'
  docNumber:            string | null
  txnDate:              string
  dueDate:              string | null
  totalAmt:             number
  balance:              number
  // Estimate: 'Pending' | 'Accepted' | 'Closed' | 'Rejected'
  // Invoice:  'Paid' | 'Unpaid' | 'Overdue'
  status:               string
  customerId:           string
  customerName:         string
  // Populated when CustomerRef points at a QB sub-customer (Project).
  // The picker uses this to render "Parent → Sub" disambiguators.
  customerParentName:   string | null
  privateNote:          string | null
  customerMemo:         string | null
  lines:                QbLine[]
  customFields:         QbCustomField[]
  linkedInvoiceId:      string | null
  linkedFromEstimateId: string | null
  linkSource:           QbLinkSource
  // Set by the client-level qb-documents endpoint to indicate which BOS Project
  // (if any) this document is associated with. Always null on the per-project
  // endpoints since those are pre-scoped.
  bosProjectId:         number | null
  bosProjectName:       string | null
}

export interface ProjectQbDocumentsResponse {
  linked:    QbDocument[]
  available: QbDocument[]
}

export interface ConvertEstimateEdits {
  txnDate:      string | null   // ISO yyyy-MM-dd
  dueDate:      string | null
  customerMemo: string | null
  lines:        QbLine[] | null // null = use estimate's lines as-is
}

export const projectEstimatesApi = {
  getAll: (projectId: number) =>
    axios.get<ProjectQbDocumentsResponse>(`/api/project/${projectId}/estimates`).then(r => r.data),

  link: (projectId: number, qbEstimateId: string) =>
    axios.post<QbDocument>(`/api/project/${projectId}/estimates/link`, { qbId: qbEstimateId })
      .then(r => r.data),

  unlink: (projectId: number, qbEstimateId: string) =>
    axios.delete(`/api/project/${projectId}/estimates/link/${encodeURIComponent(qbEstimateId)}`),

  convert: (projectId: number, qbEstimateId: string, edits: ConvertEstimateEdits) =>
    axios.post<QbDocument>(
      `/api/project/${projectId}/estimates/${encodeURIComponent(qbEstimateId)}/convert`,
      edits,
    ).then(r => r.data),
}

export const projectInvoicesApi = {
  getAll: (projectId: number) =>
    axios.get<ProjectQbDocumentsResponse>(`/api/project/${projectId}/invoices`).then(r => r.data),

  link: (projectId: number, qbInvoiceId: string) =>
    axios.post<QbDocument>(`/api/project/${projectId}/invoices/link`, { qbId: qbInvoiceId })
      .then(r => r.data),

  unlink: (projectId: number, qbInvoiceId: string) =>
    axios.delete(`/api/project/${projectId}/invoices/link/${encodeURIComponent(qbInvoiceId)}`),
}

// ── Per-project QB Project (sub-customer) link ────────────────────────────────

export interface QbSubCustomer {
  id:                string
  displayName:       string
  parentCustomerId:  string
  parentDisplayName: string
}

export interface ProjectQbProjectLink {
  qbProjectId:   string | null
  qbProjectName: string | null
}

export const projectQbProjectApi = {
  listOptions: (projectId: number) =>
    axios.get<QbSubCustomer[]>(`/api/project/${projectId}/qb-project/options`).then(r => r.data),

  set: (projectId: number, qbProjectId: string | null, qbProjectName: string | null) =>
    axios.patch<ProjectQbProjectLink>(`/api/project/${projectId}/qb-project`, { qbProjectId, qbProjectName })
      .then(r => r.data),
}
