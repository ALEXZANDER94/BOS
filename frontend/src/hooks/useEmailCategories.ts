import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { emailCategoryApi, emailAssignmentApi } from '@/api/emailCategories'

// ── Categories ────────────────────────────────────────────────────────────────

export function useEmailCategories() {
  return useQuery({
    queryKey: ['email-categories'],
    queryFn:  emailCategoryApi.getAll,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: emailCategoryApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; color: string } }) =>
      emailCategoryApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: emailCategoryApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

export function useAddCategoryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, data }: {
      categoryId: number
      data: { name: string; color: string; displayOrder?: number }
    }) => emailCategoryApi.addStatus(categoryId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

export function useUpdateCategoryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, statusId, data }: {
      categoryId: number
      statusId:   number
      data: { name: string; color: string; displayOrder: number }
    }) => emailCategoryApi.updateStatus(categoryId, statusId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

export function useDeleteCategoryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, statusId }: { categoryId: number; statusId: number }) =>
      emailCategoryApi.deleteStatus(categoryId, statusId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-categories'] }),
  })
}

// ── Assignments ───────────────────────────────────────────────────────────────

export function useEmailAssignmentsBatch(messageIds: string[]) {
  return useQuery({
    queryKey: ['email-assignments', 'batch', messageIds],
    queryFn:  () => emailAssignmentApi.getBatch(messageIds),
    enabled:  messageIds.length > 0,
    staleTime: 30 * 1000,
  })
}

export function useCategoryEmails(categoryId: number | null) {
  return useQuery({
    queryKey: ['email-assignments', 'by-category', categoryId],
    queryFn:  () => emailAssignmentApi.getByCategory(categoryId!),
    enabled:  categoryId !== null,
  })
}

export function useUpsertAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, categoryId, statusId }: {
      messageId:  string
      categoryId: number
      statusId:   number | null
    }) => emailAssignmentApi.upsert(messageId, { categoryId, statusId }),
    onSuccess: (_, { messageId }) => {
      qc.invalidateQueries({ queryKey: ['email-assignments'] })
      qc.invalidateQueries({ queryKey: ['email-assignment', messageId] })
    },
  })
}

export function usePatchAssignmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, statusId }: { messageId: string; statusId: number | null }) =>
      emailAssignmentApi.patchStatus(messageId, statusId),
    onSuccess: (_, { messageId }) => {
      qc.invalidateQueries({ queryKey: ['email-assignments'] })
      qc.invalidateQueries({ queryKey: ['email-assignment', messageId] })
    },
  })
}

export function useRemoveAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: emailAssignmentApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-assignments'] }),
  })
}

export function useEmailAssignment(messageId: string | null) {
  return useQuery({
    queryKey: ['email-assignment', messageId],
    queryFn:  () => emailAssignmentApi.getBatch([messageId!]).then(r => r[0] ?? null),
    enabled:  !!messageId,
    staleTime: 30 * 1000,
  })
}
