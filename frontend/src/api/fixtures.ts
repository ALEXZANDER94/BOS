import axios from 'axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FixtureLocation {
  id:   number
  name: string
}

export interface Fixture {
  id:           number
  buildingId:   number
  buildingName: string
  locationId:   number | null
  locationName: string | null
  code:         string
  description:  string
  quantity:     number
  note:         string
  createdAt:    string
  updatedAt:    string
}

export interface CreateFixtureRequest {
  locationId:  number | null
  code:        string
  description: string
  quantity:    number
  note:        string
}

export interface UpdateFixtureRequest {
  locationId:  number | null
  code:        string
  description: string
  quantity:    number
  note:        string
}

// ── API objects ───────────────────────────────────────────────────────────────

export const fixtureLocationApi = {
  getAll: () =>
    axios.get<FixtureLocation[]>('/api/fixture-locations').then(r => r.data),

  create: (name: string) =>
    axios.post<FixtureLocation>('/api/fixture-locations', { name }).then(r => r.data),

  update: (id: number, name: string) =>
    axios.put<FixtureLocation>(`/api/fixture-locations/${id}`, { name }).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`/api/fixture-locations/${id}`),
}

export const fixtureApi = {
  getByBuilding: (buildingId: number) =>
    axios.get<Fixture[]>(`/api/building/${buildingId}/fixture`).then(r => r.data),

  getByProject: (projectId: number) =>
    axios.get<Fixture[]>(`/api/project/${projectId}/fixture`).then(r => r.data),

  create: (buildingId: number, data: CreateFixtureRequest) =>
    axios.post<Fixture>(`/api/building/${buildingId}/fixture`, data).then(r => r.data),

  update: (buildingId: number, id: number, data: UpdateFixtureRequest) =>
    axios.put<Fixture>(`/api/building/${buildingId}/fixture/${id}`, data).then(r => r.data),

  delete: (buildingId: number, id: number) =>
    axios.delete(`/api/building/${buildingId}/fixture/${id}`),
}
