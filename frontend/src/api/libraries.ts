import axios from 'axios'
import type { CustomUpgrade } from './customUpgrades'

export interface Library {
  id:                number
  clientId:          number
  title:             string
  description:       string
  originalFileName:  string
  contentLength:     number
  createdAt:         string
  updatedAt:         string
  bakedInUpgrades:   CustomUpgrade[]
}

export interface LibraryListItem {
  id:                number
  clientId:          number
  title:             string
  description:       string
  originalFileName:  string
  contentLength:     number
  createdAt:         string
  updatedAt:         string
}

export const libraryApi = {
  getForClient: (clientId: number) =>
    axios.get<LibraryListItem[]>('/api/libraries', { params: { clientId } }).then(r => r.data),

  getById: (id: number) =>
    axios.get<Library>(`/api/libraries/${id}`).then(r => r.data),

  create: (clientId: number, title: string, description: string, pdf: File | null) => {
    const fd = new FormData()
    fd.append('clientId', String(clientId))
    fd.append('title', title)
    fd.append('description', description)
    if (pdf) fd.append('pdf', pdf)
    return axios
      .post<Library>('/api/libraries', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data)
  },

  update: (id: number, title: string, description: string, pdf: File | null) => {
    const fd = new FormData()
    fd.append('title', title)
    fd.append('description', description)
    if (pdf) fd.append('pdf', pdf)
    return axios
      .put<Library>(`/api/libraries/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data)
  },

  delete: (id: number) =>
    axios.delete(`/api/libraries/${id}`),

  // Returns the URL the browser should open to view the PDF.
  // The endpoint requires auth (cookie) — same-origin fetch carries it automatically.
  pdfUrl: (id: number) => `/api/libraries/${id}/pdf`,

  addUpgrade: (libraryId: number, upgradeId: number) =>
    axios.post<Library>(`/api/libraries/${libraryId}/upgrades/${upgradeId}`).then(r => r.data),

  removeUpgrade: (libraryId: number, upgradeId: number) =>
    axios.delete<Library>(`/api/libraries/${libraryId}/upgrades/${upgradeId}`).then(r => r.data),
}
