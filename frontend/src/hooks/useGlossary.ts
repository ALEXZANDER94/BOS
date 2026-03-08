import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  glossaryApi,
  type CreateGlossaryUnitRequest,
  type UpdateGlossaryUnitRequest,
  type CsvImportResultDto,
} from '@/api/glossary'

// Query key includes supplierId so React Query keeps separate caches per supplier.
// The search term is also included so filtered results don't pollute the unfiltered cache.
const key = (supplierId: number, search?: string) => ['glossary', supplierId, search ?? '']

export function useGlossaryUnits(supplierId: number, search?: string) {
  return useQuery({
    queryKey: key(supplierId, search),
    queryFn: () => glossaryApi.getAll(supplierId, search),
    enabled: supplierId > 0,
  })
}

export function useCreateUnit(supplierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGlossaryUnitRequest) => glossaryApi.create(supplierId, data),
    onSuccess: () => {
      // Invalidate all glossary queries for this supplier so every search cache refreshes
      qc.invalidateQueries({ queryKey: ['glossary', supplierId] })
      toast.success('Unit added successfully.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to add unit.')
    },
  })
}

export function useUpdateUnit(supplierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGlossaryUnitRequest }) =>
      glossaryApi.update(supplierId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary', supplierId] })
      toast.success('Unit updated successfully.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update unit.')
    },
  })
}

export function useDeleteUnit(supplierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => glossaryApi.delete(supplierId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary', supplierId] })
      toast.success('Unit deleted.')
    },
    onError: () => {
      toast.error('Failed to delete unit.')
    },
  })
}

export function useImportGlossary(supplierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, overwrite }: { file: File; overwrite: boolean }) =>
      glossaryApi.importFromCsv(supplierId, file, overwrite),
    onSuccess: (result: CsvImportResultDto) => {
      qc.invalidateQueries({ queryKey: ['glossary', supplierId] })
      const parts: string[] = []
      if (result.importedCount > 0) parts.push(`${result.importedCount} imported`)
      if (result.updatedCount  > 0) parts.push(`${result.updatedCount} updated`)
      if (result.skippedCount  > 0) parts.push(`${result.skippedCount} skipped`)
      if (result.errorCount    > 0) parts.push(`${result.errorCount} error${result.errorCount !== 1 ? 's' : ''}`)
      const summary = parts.length > 0 ? parts.join(', ') : 'Nothing to import'
      toast.success(`Import complete — ${summary}.`)
    },
    onError: () => {
      toast.error('Import failed. Check that the file is a valid CSV.')
    },
  })
}
