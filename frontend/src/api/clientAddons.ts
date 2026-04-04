import axios from 'axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectAssignment {
  projectId:   number
  projectName: string
  price:       number | null
}

export interface ClientAddon {
  id:          number
  clientId:    number
  code:        string
  description: string
  notes:       string
  assignments: ProjectAssignment[]
}

// Used by the project-side panel
export interface ProjectAddonOption {
  addonId:     number
  code:        string
  description: string
  notes:       string
  isAssigned:  boolean
  price:       number | null
}

export interface AddonCsvRowError {
  rowNumber: number
  code:      string
  reason:    string
}

export interface AddonCsvImportResult {
  addonsImported:     number
  addonsUpdated:      number
  assignmentsCreated: number
  assignmentsUpdated: number
  errorCount:         number
  errors:             AddonCsvRowError[]
}

// ── Client-scoped addon API ───────────────────────────────────────────────────

const base = (clientId: number) => `/api/client/${clientId}/addon`

export const clientAddonsApi = {
  getAll: (clientId: number) =>
    axios.get<ClientAddon[]>(base(clientId)).then(r => r.data),

  create: (clientId: number, data: { code: string; description: string; notes: string }) =>
    axios.post<ClientAddon>(base(clientId), data).then(r => r.data),

  update: (clientId: number, addonId: number, data: { code: string; description: string; notes: string }) =>
    axios.put<ClientAddon>(`${base(clientId)}/${addonId}`, data).then(r => r.data),

  delete: (clientId: number, addonId: number) =>
    axios.delete(`${base(clientId)}/${addonId}`),

  upsertAssignment: (clientId: number, addonId: number, projectId: number, price: number | null) =>
    axios.put<ProjectAssignment>(
      `${base(clientId)}/${addonId}/assignment/${projectId}`,
      { price }
    ).then(r => r.data),

  removeAssignment: (clientId: number, addonId: number, projectId: number) =>
    axios.delete(`${base(clientId)}/${addonId}/assignment/${projectId}`),

  importFromCsv: (clientId: number, projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('projectId', String(projectId))
    return axios.post<AddonCsvImportResult>(
      `${base(clientId)}/import`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
}

// ── Project-scoped assignment API ─────────────────────────────────────────────

const projectBase = (projectId: number) => `/api/projects/${projectId}/addon-options`

export const projectAddonAssignmentsApi = {
  getOptions: (projectId: number) =>
    axios.get<ProjectAddonOption[]>(projectBase(projectId)).then(r => r.data),

  upsert: (projectId: number, addonId: number, price: number | null) =>
    axios.put(`${projectBase(projectId)}/${addonId}`, { price }),

  remove: (projectId: number, addonId: number) =>
    axios.delete(`${projectBase(projectId)}/${addonId}`),

  bulkAssign: (projectId: number, items: { addonId: number; price: number | null }[]) =>
    axios.post(`${projectBase(projectId)}/bulk`, { items }),
}
