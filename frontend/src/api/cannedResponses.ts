import axios from 'axios'

export interface CannedResponseCategory {
  id:            number
  name:          string
  sortOrder:     number
  responseCount: number
}

export interface CannedResponseAttachment {
  id:              number
  fileName:        string
  contentType:     string
  fileSize:        number
  uploadedByEmail: string
  uploadedAt:      string
}

export interface CannedResponse {
  id:                 number
  categoryId:         number
  categoryName:       string
  name:               string
  subject:            string | null
  bodyHtml:           string
  defaultTo:          string | null
  defaultCc:          string | null
  defaultBcc:         string | null
  createdByUserEmail: string
  createdAt:          string
  updatedAt:          string
  attachments:        CannedResponseAttachment[]
}

export interface CannedResponseInput {
  categoryId: number
  name:       string
  subject?:   string | null
  bodyHtml:   string
  defaultTo?:  string | null
  defaultCc?:  string | null
  defaultBcc?: string | null
}

const BASE = '/api/canned-responses'

export const cannedResponseApi = {
  listCategories: () =>
    axios.get<CannedResponseCategory[]>(`${BASE}/categories`).then(r => r.data),

  createCategory: (data: { name: string; sortOrder?: number }) =>
    axios.post<CannedResponseCategory>(`${BASE}/categories`, data).then(r => r.data),

  updateCategory: (id: number, data: { name: string; sortOrder?: number }) =>
    axios.put<CannedResponseCategory>(`${BASE}/categories/${id}`, data).then(r => r.data),

  deleteCategory: (id: number) =>
    axios.delete(`${BASE}/categories/${id}`),

  list: () =>
    axios.get<CannedResponse[]>(BASE).then(r => r.data),

  get: (id: number) =>
    axios.get<CannedResponse>(`${BASE}/${id}`).then(r => r.data),

  create: (data: CannedResponseInput) =>
    axios.post<CannedResponse>(BASE, data).then(r => r.data),

  update: (id: number, data: CannedResponseInput) =>
    axios.put<CannedResponse>(`${BASE}/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`${BASE}/${id}`),

  uploadAttachment: (responseId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios
      .post<CannedResponseAttachment>(`${BASE}/${responseId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  deleteAttachment: (attachmentId: number) =>
    axios.delete(`${BASE}/attachments/${attachmentId}`),

  attachmentDownloadUrl: (attachmentId: number) =>
    `${BASE}/attachments/${attachmentId}`,
}
