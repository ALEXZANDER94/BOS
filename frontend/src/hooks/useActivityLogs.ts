import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  activityApi,
  type CreateActivityLogRequest,
  type UpdateActivityLogRequest,
} from '@/api/clients'

export function useActivityLogs(clientId: number) {
  return useQuery({
    queryKey: ['activity', clientId],
    queryFn:  () => activityApi.getAll(clientId),
    enabled:  clientId > 0,
  })
}

export function useCreateActivity(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateActivityLogRequest) => activityApi.create(clientId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Activity logged.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to log activity.')
    },
  })
}

export function useUpdateActivity(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateActivityLogRequest }) =>
      activityApi.update(clientId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity', clientId] })
      toast.success('Activity updated.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update activity.')
    },
  })
}

export function useDeleteActivity(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => activityApi.delete(clientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Activity deleted.')
    },
    onError: () => {
      toast.error('Failed to delete activity.')
    },
  })
}
