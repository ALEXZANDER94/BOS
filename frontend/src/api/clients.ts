import axios from 'axios'
import type { QbDocument } from './projects'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Contact {
  id:        number
  clientId:  number
  name:      string
  email:     string
  phone:     string
  title:     string
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export interface Project {
  id:               number
  clientId:         number
  name:             string
  description:      string
  status:           string   // Active | Completed | On Hold | Cancelled
  startDate:        string | null
  endDate:          string | null
  createdAt:        string
  updatedAt:        string
  assignedContacts: Contact[]
}

export interface ProjectWithClient extends Project {
  clientName: string
}

export interface ActivityLog {
  id:         number
  clientId:   number
  type:       string   // Call | Email | Meeting | Note
  note:       string
  occurredAt: string
  createdAt:  string
  updatedAt:  string
}

export interface Client {
  id:             number
  name:           string
  description:    string
  status:         string   // Active | Inactive
  industry:       string
  website:        string
  domain:         string
  street:         string
  city:           string
  state:          string
  zip:            string
  createdAt:      string
  updatedAt:      string
  primaryContact: Contact | null
  contactCount:   number
  projectCount:   number
  activityCount:  number
  showContacts:   boolean
  showProjects:   boolean
  showProposals:  boolean
  showLibraries:  boolean
  showActivity:   boolean
  showOptions:    boolean
  qbCustomerId:   string | null
  qbCustomerName: string | null
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateClientRequest {
  name:        string
  description: string
  status:      string
  industry:    string
  website:     string
  domain:      string
  street:      string
  city:        string
  state:       string
  zip:         string
}

export interface UpdateClientRequest extends CreateClientRequest {
  showContacts:  boolean
  showProjects:  boolean
  showProposals: boolean
  showLibraries: boolean
  showActivity:  boolean
  showOptions:   boolean
}

export interface CreateContactRequest {
  name:      string
  email:     string
  phone:     string
  title:     string
  isPrimary: boolean
}

export type UpdateContactRequest = CreateContactRequest

export interface CreateProjectRequest {
  name:        string
  description: string
  status:      string
  startDate:   string | null
  endDate:     string | null
}

export type UpdateProjectRequest = CreateProjectRequest

export interface CreateActivityLogRequest {
  type:       string
  note:       string
  occurredAt: string
}

export type UpdateActivityLogRequest = CreateActivityLogRequest

// ── API objects ───────────────────────────────────────────────────────────────

const BASE = '/api/client'

export const clientApi = {
  getAll: (search?: string, status?: string) => {
    const params: Record<string, string> = {}
    if (search)  params.search = search
    if (status)  params.status = status
    return axios.get<Client[]>(BASE, { params }).then(r => r.data)
  },

  getById: (id: number) =>
    axios.get<Client>(`${BASE}/${id}`).then(r => r.data),

  create: (data: CreateClientRequest) =>
    axios.post<Client>(BASE, data).then(r => r.data),

  update: (id: number, data: UpdateClientRequest) =>
    axios.put<Client>(`${BASE}/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`${BASE}/${id}`),

  setQbCustomer: (id: number, qbCustomerId: string | null, qbCustomerName: string | null) =>
    axios.patch<Client>(`${BASE}/${id}/qb-customer`, { qbCustomerId, qbCustomerName }).then(r => r.data),
}

export const contactApi = {
  getAll: (clientId: number) =>
    axios.get<Contact[]>(`${BASE}/${clientId}/contact`).then(r => r.data),

  create: (clientId: number, data: CreateContactRequest) =>
    axios.post<Contact>(`${BASE}/${clientId}/contact`, data).then(r => r.data),

  update: (clientId: number, id: number, data: UpdateContactRequest) =>
    axios.put<Contact>(`${BASE}/${clientId}/contact/${id}`, data).then(r => r.data),

  delete: (clientId: number, id: number) =>
    axios.delete(`${BASE}/${clientId}/contact/${id}`),
}

export const projectApi = {
  getAll: (clientId: number) =>
    axios.get<Project[]>(`${BASE}/${clientId}/project`).then(r => r.data),

  create: (clientId: number, data: CreateProjectRequest) =>
    axios.post<Project>(`${BASE}/${clientId}/project`, data).then(r => r.data),

  update: (clientId: number, id: number, data: UpdateProjectRequest) =>
    axios.put<Project>(`${BASE}/${clientId}/project/${id}`, data).then(r => r.data),

  delete: (clientId: number, id: number) =>
    axios.delete(`${BASE}/${clientId}/project/${id}`),

  assignContact: (clientId: number, projectId: number, contactId: number) =>
    axios.post(`${BASE}/${clientId}/project/${projectId}/contact/${contactId}`),

  unassignContact: (clientId: number, projectId: number, contactId: number) =>
    axios.delete(`${BASE}/${clientId}/project/${projectId}/contact/${contactId}`),
}

export const allProjectsApi = {
  getAll: (search?: string, status?: string, clientId?: number) => {
    const params: Record<string, string> = {}
    if (search)   params.search   = search
    if (status)   params.status   = status
    if (clientId) params.clientId = String(clientId)
    return axios.get<ProjectWithClient[]>('/api/project', { params }).then(r => r.data)
  },
}

// ── Client-scoped QuickBooks Estimates & Invoices ────────────────────────────

export interface ClientQbDocumentsResponse {
  estimates: QbDocument[]
  invoices:  QbDocument[]
}

export const clientQbDocumentsApi = {
  getAll: (clientId: number) =>
    axios.get<ClientQbDocumentsResponse>(`${BASE}/${clientId}/qb-documents`).then(r => r.data),
}

export const activityApi = {
  getAll: (clientId: number) =>
    axios.get<ActivityLog[]>(`${BASE}/${clientId}/activity`).then(r => r.data),

  create: (clientId: number, data: CreateActivityLogRequest) =>
    axios.post<ActivityLog>(`${BASE}/${clientId}/activity`, data).then(r => r.data),

  update: (clientId: number, id: number, data: UpdateActivityLogRequest) =>
    axios.put<ActivityLog>(`${BASE}/${clientId}/activity/${id}`, data).then(r => r.data),

  delete: (clientId: number, id: number) =>
    axios.delete(`${BASE}/${clientId}/activity/${id}`),
}
