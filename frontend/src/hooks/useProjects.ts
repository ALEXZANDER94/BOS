import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  projectApi,
  allProjectsApi,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from '@/api/clients'

export function useProjects(clientId: number) {
  return useQuery({
    queryKey: ['projects', clientId],
    queryFn:  () => projectApi.getAll(clientId),
    enabled:  clientId > 0,
  })
}

export function useAllProjects(search?: string, status?: string, clientId?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['all-projects', search, status, clientId],
    queryFn:  () => allProjectsApi.getAll(search, status, clientId),
    enabled:  options?.enabled !== false,
  })
}

export function useCreateProject(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectApi.create(clientId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Project added.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to add project.')
    },
  })
}

export function useUpdateProject(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      projectApi.update(clientId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Project updated.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update project.')
    },
  })
}

export function useDeleteProject(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => projectApi.delete(clientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Project deleted.')
    },
    onError: () => {
      toast.error('Failed to delete project.')
    },
  })
}

export function useAssignProjectContact(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, contactId }: { projectId: number; contactId: number }) =>
      projectApi.assignContact(clientId, projectId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', clientId] })
    },
    onError: () => {
      toast.error('Failed to assign contact.')
    },
  })
}

export function useUnassignProjectContact(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, contactId }: { projectId: number; contactId: number }) =>
      projectApi.unassignContact(clientId, projectId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', clientId] })
    },
    onError: () => {
      toast.error('Failed to remove contact.')
    },
  })
}
