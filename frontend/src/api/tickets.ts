import axios from 'axios'

// ── Category ──────────────────────────────────────────────────────────────────

export interface TicketCategory {
  id:    number
  name:  string
  color: string
}

export interface CreateTicketCategoryRequest { name: string; color: string }
export interface UpdateTicketCategoryRequest { name: string; color: string }

// ── Status ────────────────────────────────────────────────────────────────────

export interface TicketStatus {
  id:           number
  name:         string
  color:        string
  isDefault:    boolean
  isClosed:     boolean
  displayOrder: number
}

export interface CreateTicketStatusRequest {
  name: string; color: string; isDefault: boolean; isClosed: boolean
}
export interface UpdateTicketStatusRequest {
  name: string; color: string; isDefault: boolean; isClosed: boolean; displayOrder: number
}

// ── Attachment ────────────────────────────────────────────────────────────────

export interface TicketAttachment {
  id:              number
  ticketId:        number
  fileName:        string
  contentType:     string
  fileSize:        number
  uploadedByEmail: string
  uploadedAt:      string
}

// ── Comment ───────────────────────────────────────────────────────────────────

export interface TicketComment {
  id:          number
  ticketId:    number
  authorEmail: string
  body:        string
  isPrivate:   boolean
  isDeleted:   boolean
  createdAt:   string
  updatedAt:   string | null
}

export interface CreateTicketCommentRequest { body: string; isPrivate: boolean }
export interface UpdateTicketCommentRequest { body: string }

// ── History ───────────────────────────────────────────────────────────────────

export interface TicketHistory {
  id:             number
  ticketId:       number
  changedByEmail: string
  fieldChanged:   string
  oldValue:       string | null
  newValue:       string | null
  changedAt:      string
}

// ── Watcher ───────────────────────────────────────────────────────────────────

export interface TicketWatcher {
  ticketId:  number
  userEmail: string
}

// ── Summary (list view) ───────────────────────────────────────────────────────

export interface TicketSummary {
  id:                   number
  ticketNumber:         string
  title:                string
  priority:             string
  categoryId:           number | null
  categoryName:         string | null
  categoryColor:        string | null
  statusId:             number
  statusName:           string
  statusColor:          string
  statusIsClosed:       boolean
  createdByEmail:       string
  assignedToEmail:      string | null
  projectId:            number | null
  projectName:          string | null
  linkedEmailMessageId: string | null
  dueDate:              string | null
  isOverdue:            boolean
  commentCount:         number
  attachmentCount:      number
  createdAt:            string
  updatedAt:            string
}

// ── Detail ────────────────────────────────────────────────────────────────────

export interface TicketDetail extends TicketSummary {
  description: string
  closedAt:    string | null
  isWatching:  boolean
  comments:    TicketComment[]
  watchers:    TicketWatcher[]
  attachments: TicketAttachment[]
}

// ── Create / Update ───────────────────────────────────────────────────────────

export interface CreateTicketRequest {
  title:                string
  description:          string
  priority:             string
  categoryId:           number | null
  statusId:             number | null
  assignedToEmail:      string | null
  projectId:            number | null
  linkedEmailMessageId: string | null
  dueDate:              string | null
}

export interface UpdateTicketRequest {
  title:                string
  description:          string
  priority:             string
  categoryId:           number | null
  statusId:             number
  assignedToEmail:      string | null
  projectId:            number | null
  linkedEmailMessageId: string | null
  dueDate:              string | null
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface TicketStats {
  openCount:           number
  overdueCount:        number
  assignedToMeCount:   number
  closedThisMonthCount: number
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  ticketStats:        TicketStats
  recentTickets:      TicketSummary[]
  myOpenTickets:      TicketSummary[]
  activeProjectCount: number
  buildingCount:      number
  lotCount:           number
  totalPurchaseOrders: number
  totalPoAmount:       number
}

// ── List response ─────────────────────────────────────────────────────────────

export interface TicketListResponse {
  items:    TicketSummary[]
  total:    number
  page:     number
  pageSize: number
}

export interface TicketListParams {
  search?:       string
  priority?:     string
  categoryId?:   number
  statusId?:     number
  showClosed?:   boolean
  assignedTo?:   string
  projectId?:    number
  myTickets?:    boolean
  page?:         number
  pageSize?:     number
}

// ── API ───────────────────────────────────────────────────────────────────────

export const ticketCategoryApi = {
  getAll: () =>
    axios.get<TicketCategory[]>('/api/ticket-categories').then(r => r.data),
  create: (req: CreateTicketCategoryRequest) =>
    axios.post<TicketCategory>('/api/ticket-categories', req).then(r => r.data),
  update: (id: number, req: UpdateTicketCategoryRequest) =>
    axios.put<TicketCategory>(`/api/ticket-categories/${id}`, req).then(r => r.data),
  delete: (id: number) =>
    axios.delete(`/api/ticket-categories/${id}`).then(() => undefined),
}

export const ticketStatusApi = {
  getAll: () =>
    axios.get<TicketStatus[]>('/api/ticket-statuses').then(r => r.data),
  create: (req: CreateTicketStatusRequest) =>
    axios.post<TicketStatus>('/api/ticket-statuses', req).then(r => r.data),
  update: (id: number, req: UpdateTicketStatusRequest) =>
    axios.put<TicketStatus>(`/api/ticket-statuses/${id}`, req).then(r => r.data),
  delete: (id: number) =>
    axios.delete(`/api/ticket-statuses/${id}`).then(() => undefined),
}

export const ticketApi = {
  list: (params?: TicketListParams) =>
    axios.get<TicketListResponse>('/api/tickets', { params }).then(r => r.data),
  getByEmail: (messageId: string) =>
    axios.get<TicketSummary[]>('/api/tickets/by-email', { params: { messageId } }).then(r => r.data),
  getById: (id: number) =>
    axios.get<TicketDetail>(`/api/tickets/${id}`).then(r => r.data),
  create: (req: CreateTicketRequest) =>
    axios.post<TicketDetail>('/api/tickets', req).then(r => r.data),
  update: (id: number, req: UpdateTicketRequest) =>
    axios.put<TicketDetail>(`/api/tickets/${id}`, req).then(r => r.data),
  delete: (id: number) =>
    axios.delete(`/api/tickets/${id}`).then(() => undefined),
  getStats: () =>
    axios.get<TicketStats>('/api/tickets/stats').then(r => r.data),

  // Comments
  addComment: (ticketId: number, req: CreateTicketCommentRequest) =>
    axios.post<TicketComment>(`/api/tickets/${ticketId}/comments`, req).then(r => r.data),
  updateComment: (ticketId: number, commentId: number, req: UpdateTicketCommentRequest) =>
    axios.put<TicketComment>(`/api/tickets/${ticketId}/comments/${commentId}`, req).then(r => r.data),
  deleteComment: (ticketId: number, commentId: number) =>
    axios.delete(`/api/tickets/${ticketId}/comments/${commentId}`).then(() => undefined),

  // History
  getHistory: (ticketId: number) =>
    axios.get<TicketHistory[]>(`/api/tickets/${ticketId}/history`).then(r => r.data),

  // Watchers
  watch: (ticketId: number) =>
    axios.post(`/api/tickets/${ticketId}/watch`).then(() => undefined),
  unwatch: (ticketId: number) =>
    axios.delete(`/api/tickets/${ticketId}/watch`).then(() => undefined),

  // Attachments
  uploadAttachment: (ticketId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post<TicketAttachment>(`/api/tickets/${ticketId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  deleteAttachment: (attachmentId: number) =>
    axios.delete(`/api/tickets/attachments/${attachmentId}`).then(() => undefined),
  getAttachmentUrl: (attachmentId: number) =>
    `/api/tickets/attachments/${attachmentId}`,
}

export const dashboardApi = {
  get: () => axios.get<DashboardData>('/api/dashboard').then(r => r.data),
}
