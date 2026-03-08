import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  supplierApi,
  type CreateSupplierRequest,
  type UpdateSupplierRequest,
  type UpsertComparisonCriteriaRequest,
} from '@/api/suppliers'

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.getAll(),
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSupplierRequest) => supplierApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier added successfully.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to add supplier.')
    },
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSupplierRequest }) =>
      supplierApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated successfully.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update supplier.')
    },
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => supplierApi.delete(id),
    onSuccess: () => {
      // Invalidate both suppliers list AND all glossary caches
      // (cascade delete wipes all units for the deleted supplier)
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['glossary'] })
      toast.success('Supplier deleted.')
    },
    onError: () => {
      toast.error('Failed to delete supplier.')
    },
  })
}

export function useUpsertCriteria(supplierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertComparisonCriteriaRequest) =>
      supplierApi.upsertCriteria(supplierId, data),
    onSuccess: () => {
      // Refresh supplier list so the criteria indicator updates
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Comparison criteria saved.')
    },
    onError: () => {
      toast.error('Failed to save criteria.')
    },
  })
}
