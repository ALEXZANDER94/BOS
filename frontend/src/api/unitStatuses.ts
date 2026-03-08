import axios from 'axios'

export interface GlossaryUnitStatus {
  id:        number
  name:      string
  color:     string
  createdAt: string
  updatedAt: string
}

export interface CreateGlossaryUnitStatusRequest {
  name:  string
  color: string
}

export interface UpdateGlossaryUnitStatusRequest {
  name:  string
  color: string
}

export const unitStatusApi = {
  getAll: (): Promise<GlossaryUnitStatus[]> =>
    axios.get<GlossaryUnitStatus[]>('/api/glossary-unit-statuses').then(r => r.data),

  create: (data: CreateGlossaryUnitStatusRequest): Promise<GlossaryUnitStatus> =>
    axios.post<GlossaryUnitStatus>('/api/glossary-unit-statuses', data).then(r => r.data),

  update: (id: number, data: UpdateGlossaryUnitStatusRequest): Promise<GlossaryUnitStatus> =>
    axios.put<GlossaryUnitStatus>(`/api/glossary-unit-statuses/${id}`, data).then(r => r.data),

  delete: (id: number): Promise<void> =>
    axios.delete(`/api/glossary-unit-statuses/${id}`).then(() => undefined),
}
