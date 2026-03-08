import axios from 'axios'

// ---------------------------------------------------------------------------
// Types — mirror the C# DTOs exactly so TypeScript catches mismatches.
// ---------------------------------------------------------------------------

export interface GlossaryUnit {
  id: number
  supplierId: number
  catalogNumber: string
  description: string
  mfr: string
  contractedPrice: number
  addedVia: string     // "Manual" | "CSV" | "Comparison"
  statusId?:    number | null
  statusName?:  string | null
  statusColor?: string | null
  createdAt: string
  updatedAt: string
  notes?: string | null
}

export interface CreateGlossaryUnitRequest {
  catalogNumber: string
  description: string
  mfr: string
  contractedPrice: number
  addedVia?: string    // defaults to "Manual" on the backend if omitted
  statusId?: number | null
}

export interface UpdateGlossaryUnitRequest extends CreateGlossaryUnitRequest {
  notes?: string | null
}

// Mirrors CsvRowError C# record
export interface CsvRowError {
  rowNumber: number
  catalogNumber: string
  reason: string
}

// Mirrors CsvImportResultDto C# record
export interface CsvImportResultDto {
  importedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  errors: CsvRowError[]
}

// ---------------------------------------------------------------------------
// API functions — thin wrappers around axios that return typed data.
// All functions are scoped to a specific supplier via the route prefix
// /api/supplier/{supplierId}/glossary
// ---------------------------------------------------------------------------

const base = (supplierId: number) => `/api/supplier/${supplierId}/glossary`

export const glossaryApi = {
  getAll: (supplierId: number, search?: string) =>
    axios
      .get<GlossaryUnit[]>(base(supplierId), { params: search ? { search } : undefined })
      .then(r => r.data),

  create: (supplierId: number, data: CreateGlossaryUnitRequest) =>
    axios.post<GlossaryUnit>(base(supplierId), data).then(r => r.data),

  update: (supplierId: number, id: number, data: UpdateGlossaryUnitRequest) =>
    axios.put<GlossaryUnit>(`${base(supplierId)}/${id}`, data).then(r => r.data),

  delete: (supplierId: number, id: number) =>
    axios.delete(`${base(supplierId)}/${id}`),

  importFromCsv: (supplierId: number, file: File, overwrite: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return axios
      .post<CsvImportResultDto>(`${base(supplierId)}/import?overwrite=${overwrite}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },
}
