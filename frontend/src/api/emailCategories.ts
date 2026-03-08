import axios from 'axios'

export interface EmailCategoryStatus {
  id:           number
  categoryId:   number
  name:         string
  color:        string
  displayOrder: number
}

export interface EmailCategory {
  id:                 number
  name:               string
  color:              string
  createdByUserEmail: string
  statuses:           EmailCategoryStatus[]
}

export interface EmailAssignment {
  id:                  number
  messageId:           string
  categoryId:          number
  categoryName:        string
  categoryColor:       string
  statusId:            number | null
  statusName:          string | null
  statusColor:         string | null
  assignedByUserEmail: string
  assignedAt:          string
}

export interface CategoryEmailsResponse {
  emails:      import('./gmail').EmailSummary[]
  assignments: EmailAssignment[]
}

const BASE = '/api'

export const emailCategoryApi = {
  getAll: () =>
    axios.get<EmailCategory[]>(`${BASE}/email-categories`).then(r => r.data),

  create: (data: { name: string; color: string }) =>
    axios.post<EmailCategory>(`${BASE}/email-categories`, data).then(r => r.data),

  update: (id: number, data: { name: string; color: string }) =>
    axios.put<EmailCategory>(`${BASE}/email-categories/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`${BASE}/email-categories/${id}`),

  addStatus: (categoryId: number, data: { name: string; color: string; displayOrder?: number }) =>
    axios.post<EmailCategoryStatus>(
      `${BASE}/email-categories/${categoryId}/statuses`, data).then(r => r.data),

  updateStatus: (categoryId: number, statusId: number, data: { name: string; color: string; displayOrder: number }) =>
    axios.put<EmailCategoryStatus>(
      `${BASE}/email-categories/${categoryId}/statuses/${statusId}`, data).then(r => r.data),

  deleteStatus: (categoryId: number, statusId: number) =>
    axios.delete(`${BASE}/email-categories/${categoryId}/statuses/${statusId}`),
}

export const emailAssignmentApi = {
  getBatch: (messageIds: string[]) =>
    axios.get<EmailAssignment[]>(`${BASE}/email-assignments/batch`, {
      params: { messageIds: messageIds.join(',') },
    }).then(r => r.data),

  getByCategory: (categoryId: number) =>
    axios.get<CategoryEmailsResponse>(
      `${BASE}/email-assignments/by-category/${categoryId}`).then(r => r.data),

  upsert: (messageId: string, data: { categoryId: number; statusId: number | null }) =>
    axios.put<EmailAssignment>(
      `${BASE}/email-assignments/${encodeURIComponent(messageId)}`, data).then(r => r.data),

  patchStatus: (messageId: string, statusId: number | null) =>
    axios.patch<EmailAssignment>(
      `${BASE}/email-assignments/${encodeURIComponent(messageId)}/status`,
      { statusId }).then(r => r.data),

  remove: (messageId: string) =>
    axios.delete(`${BASE}/email-assignments/${encodeURIComponent(messageId)}`),
}
