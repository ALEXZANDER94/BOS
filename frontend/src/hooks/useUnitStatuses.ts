import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  unitStatusApi,
  type CreateGlossaryUnitStatusRequest,
  type UpdateGlossaryUnitStatusRequest,
} from '@/api/unitStatuses'

const KEY = ['unit-statuses'] as const

export function useUnitStatuses() {
  return useQuery({
    queryKey: KEY,
    queryFn: unitStatusApi.getAll,
  })
}

export function useCreateUnitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGlossaryUnitStatusRequest) => unitStatusApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Status created.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to create status.')
    },
  })
}

export function useUpdateUnitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGlossaryUnitStatusRequest }) =>
      unitStatusApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Status updated.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update status.')
    },
  })
}

export function useDeleteUnitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unitStatusApi.delete(id),
    onSuccess: () => {
      // Invalidate both statuses list and glossary (deleted status unlinks from units)
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['glossary'] })
      toast.success('Status deleted.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to delete status.')
    },
  })
}
