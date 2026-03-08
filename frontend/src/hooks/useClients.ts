import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  clientApi,
  type CreateClientRequest,
  type UpdateClientRequest,
} from '@/api/clients'

export function useClients(search?: string, status?: string) {
  return useQuery({
    queryKey: ['clients', search, status],
    queryFn:  () => clientApi.getAll(search, status),
  })
}

export function useClient(id: number | null) {
  return useQuery({
    queryKey: ['client', id],
    queryFn:  () => clientApi.getById(id!),
    enabled:  id !== null,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateClientRequest) => clientApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client added.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to add client.')
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateClientRequest }) =>
      clientApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client updated.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update client.')
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => clientApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted.')
    },
    onError: () => {
      toast.error('Failed to delete client.')
    },
  })
}
