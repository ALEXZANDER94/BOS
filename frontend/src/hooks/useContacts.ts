import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  contactApi,
  type CreateContactRequest,
  type UpdateContactRequest,
} from '@/api/clients'

export function useContacts(clientId: number) {
  return useQuery({
    queryKey: ['contacts', clientId],
    queryFn:  () => contactApi.getAll(clientId),
    enabled:  clientId > 0,
  })
}

export function useCreateContact(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateContactRequest) => contactApi.create(clientId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Contact added.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to add contact.')
    },
  })
}

export function useUpdateContact(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateContactRequest }) =>
      contactApi.update(clientId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Contact updated.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update contact.')
    },
  })
}

export function useDeleteContact(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => contactApi.delete(clientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Contact removed.')
    },
    onError: () => {
      toast.error('Failed to remove contact.')
    },
  })
}
