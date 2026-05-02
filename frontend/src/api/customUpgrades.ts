import axios from 'axios'

export interface CustomUpgrade {
  id:          number
  clientId:    number | null
  isGlobal:    boolean
  name:        string
  description: string
  createdAt:   string
}

export interface CreateCustomUpgradeRequest {
  clientId:    number | null
  isGlobal:    boolean
  name:        string
  description: string
}

export interface UpdateCustomUpgradeRequest {
  clientId:    number | null
  isGlobal:    boolean
  name:        string
  description: string
}

export interface CustomUpgradeUsageRef {
  kind: string  // "Proposal" | "Project" | "Library"
  id:   number
  name: string
}

export interface CustomUpgradeUsage {
  proposalCount: number
  projectCount:  number
  libraryCount:  number
  references:    CustomUpgradeUsageRef[]
}

export const customUpgradeApi = {
  // Returns union of (this client's upgrades + globals); pass null for globals only.
  getForClient: (clientId: number | null) => {
    const params = clientId !== null ? { clientId } : undefined
    return axios.get<CustomUpgrade[]>('/api/upgrades', { params }).then(r => r.data)
  },

  getById: (id: number) =>
    axios.get<CustomUpgrade>(`/api/upgrades/${id}`).then(r => r.data),

  getUsage: (id: number) =>
    axios.get<CustomUpgradeUsage>(`/api/upgrades/${id}/usage`).then(r => r.data),

  create: (data: CreateCustomUpgradeRequest) =>
    axios.post<CustomUpgrade>('/api/upgrades', data).then(r => r.data),

  update: (id: number, data: UpdateCustomUpgradeRequest) =>
    axios.put<CustomUpgrade>(`/api/upgrades/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`/api/upgrades/${id}`),
}
