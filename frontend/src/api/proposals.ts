import axios from 'axios'

export type ProposalType   = 'SingleFamily' | 'MultiFamily'
export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Rejected'

export interface ProposalListItem {
  id:                  number
  clientId:            number
  name:                string
  type:                ProposalType
  status:              ProposalStatus
  convertedProjectId:  number | null
  deadline:            string | null
  createdAt:           string
  updatedAt:           string
}

export interface ProposalPlan {
  id:            number
  planName:      string
  squareFootage: number
  amount:        number
}

export interface ProposalBuilding {
  id:    number
  name:  string
  plans: ProposalPlan[]
}

export interface ProposalUpgradeState {
  customUpgradeId: number
  name:            string
  description:     string
  isGlobal:        boolean
  isEnabled:       boolean
}

export interface ProposalPricing {
  id:           number
  label:        string
  pricePerSqFt: number
  totalAmount:  number
  notes:        string
  createdAt:    string
}

export interface Proposal {
  id:                   number
  clientId:             number
  name:                 string
  type:                 ProposalType
  status:               ProposalStatus
  convertedProjectId:   number | null
  deadline:             string | null
  deadlineReminderDays: number
  createdAt:            string
  updatedAt:            string
  notes:                string
  visibleFields:        string
  pdfFileName:          string | null
  pdfContentLength:     number
  // Single-family fields
  libraryId:            number | null
  libraryTitle:         string | null
  address:              string
  city:                 string
  productStandards:     string
  version:              string
  buyerUpgrades:        string
  revisionsAfterLaunch: string
  // Multi-family fields
  buildings:            ProposalBuilding[]
  // Toggle state
  customUpgrades:       ProposalUpgradeState[]
  // Pricing history
  pricings:             ProposalPricing[]
}

// ── Request shapes ───────────────────────────────────────────────────────────

export interface ProposalPlanInput {
  id:            number | null
  planName:      string
  squareFootage: number
  amount:        number
}

export interface ProposalBuildingInput {
  id:    number | null
  name:  string
  plans: ProposalPlanInput[]
}

export interface ProposalUpgradeInput {
  customUpgradeId: number
  isEnabled:       boolean
}

export interface CreateProposalRequest {
  name:                 string
  type:                 ProposalType
  status:               ProposalStatus
  deadline:             string | null
  deadlineReminderDays: number | null
  notes:                string | null
  visibleFields:        string | null
  libraryId:            number | null
  address:              string | null
  city:                 string | null
  productStandards:     string | null
  version:              string | null
  buyerUpgrades:        string | null
  revisionsAfterLaunch: string | null
  buildings:            ProposalBuildingInput[] | null
  customUpgrades:       ProposalUpgradeInput[] | null
}

export interface UpdateProposalRequest {
  name:                 string
  status:               ProposalStatus
  deadline:             string | null
  deadlineReminderDays: number | null
  notes:                string | null
  visibleFields:        string | null
  libraryId:            number | null
  address:              string | null
  city:                 string | null
  productStandards:     string | null
  version:              string | null
  buyerUpgrades:        string | null
  revisionsAfterLaunch: string | null
  buildings:            ProposalBuildingInput[] | null
  customUpgrades:       ProposalUpgradeInput[] | null
}

export interface ProposalListItemWithClient extends ProposalListItem {
  clientName: string
}

export interface ConvertProposalResult {
  projectId: number
}

export interface CreateProposalPricingRequest {
  label:        string
  pricePerSqFt: number
  totalAmount:  number
  notes:        string | null
}

export interface UpdateProposalPricingRequest {
  label:        string
  pricePerSqFt: number
  totalAmount:  number
  notes:        string | null
}

export const allProposalsApi = {
  getAll: (search?: string, status?: string, type?: string, clientId?: number, includeConverted = false) => {
    const params: Record<string, string> = {}
    if (search)   params.search   = search
    if (status)   params.status   = status
    if (type)     params.type     = type
    if (clientId) params.clientId = String(clientId)
    if (includeConverted) params.includeConverted = 'true'
    return axios.get<ProposalListItemWithClient[]>('/api/proposal', { params }).then(r => r.data)
  },
}

export const proposalApi = {
  list: (clientId: number, includeConverted = false) =>
    axios
      .get<ProposalListItem[]>(`/api/clients/${clientId}/proposals`, { params: { includeConverted } })
      .then(r => r.data),

  getById: (clientId: number, proposalId: number) =>
    axios.get<Proposal>(`/api/clients/${clientId}/proposals/${proposalId}`).then(r => r.data),

  create: (clientId: number, data: CreateProposalRequest) =>
    axios.post<Proposal>(`/api/clients/${clientId}/proposals`, data).then(r => r.data),

  update: (clientId: number, proposalId: number, data: UpdateProposalRequest) =>
    axios.put<Proposal>(`/api/clients/${clientId}/proposals/${proposalId}`, data).then(r => r.data),

  delete: (clientId: number, proposalId: number) =>
    axios.delete(`/api/clients/${clientId}/proposals/${proposalId}`),

  convert: (clientId: number, proposalId: number) =>
    axios.post<ConvertProposalResult>(`/api/clients/${clientId}/proposals/${proposalId}/convert`).then(r => r.data),

  // PDF
  uploadPdf: (clientId: number, proposalId: number, file: File) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return axios.post(`/api/clients/${clientId}/proposals/${proposalId}/pdf`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  downloadPdfUrl: (clientId: number, proposalId: number) =>
    `/api/clients/${clientId}/proposals/${proposalId}/pdf`,

  deletePdf: (clientId: number, proposalId: number) =>
    axios.delete(`/api/clients/${clientId}/proposals/${proposalId}/pdf`),

  // Pricing
  listPricings: (clientId: number, proposalId: number) =>
    axios.get<ProposalPricing[]>(`/api/clients/${clientId}/proposals/${proposalId}/pricing`).then(r => r.data),

  createPricing: (clientId: number, proposalId: number, data: CreateProposalPricingRequest) =>
    axios.post<ProposalPricing>(`/api/clients/${clientId}/proposals/${proposalId}/pricing`, data).then(r => r.data),

  updatePricing: (clientId: number, proposalId: number, pricingId: number, data: UpdateProposalPricingRequest) =>
    axios.put<ProposalPricing>(`/api/clients/${clientId}/proposals/${proposalId}/pricing/${pricingId}`, data).then(r => r.data),

  deletePricing: (clientId: number, proposalId: number, pricingId: number) =>
    axios.delete(`/api/clients/${clientId}/proposals/${proposalId}/pricing/${pricingId}`),
}
