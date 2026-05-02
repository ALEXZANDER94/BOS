import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gmailApi, type ComposeInput } from '@/api/gmail'

// ── Filter type ───────────────────────────────────────────────────────────────

export type EmailFilter =
  | { type: 'all' }
  | { type: 'client';   id: number }
  | { type: 'alias';    address: string }
  | { type: 'category'; id: number }

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail', 'status'],
    queryFn:  gmailApi.getStatus,
  })
}

export function useGmailAliases() {
  return useQuery({
    queryKey: ['gmail', 'aliases'],
    queryFn:  gmailApi.getAliases,
    staleTime: 10 * 60 * 1000, // forwarding addresses rarely change
  })
}

export function useEmails(
  filter:   EmailFilter = { type: 'all' },
  search?:  string,
  pageSize: number = 25,
) {
  return useInfiniteQuery({
    queryKey: ['gmail', 'emails', filter, search ?? '', pageSize],
    queryFn: ({ pageParam }) => {
      const params: Parameters<typeof gmailApi.listEmails>[0] = {}
      if (filter.type === 'client') params.clientId   = filter.id
      if (filter.type === 'alias')  params.alias      = filter.address
      if (search)                   params.q          = search
      if (pageParam)                params.pageToken  = pageParam as string
      params.maxResults = pageSize
      return gmailApi.listEmails(params)
    },
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled:   filter.type !== 'category',
    staleTime: 5 * 60 * 1000,
  })
}

export function useEmailDetail(messageId: string | null) {
  return useQuery({
    queryKey: ['gmail', 'email', messageId],
    queryFn:  () => gmailApi.getEmail(messageId!),
    enabled:  !!messageId,
  })
}

export function useRefreshEmails(filter: EmailFilter = { type: 'all' }, search?: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({ queryKey: ['gmail', 'emails', filter, search ?? ''] })
}

// ── Labels / drafts list ─────────────────────────────────────────────────────

export function useGmailLabels() {
  return useQuery({
    queryKey:  ['gmail', 'labels'],
    queryFn:   gmailApi.listLabels,
    staleTime: 5 * 60 * 1000,
  })
}

export function useGmailDrafts() {
  return useQuery({
    queryKey: ['gmail', 'drafts'],
    queryFn:  gmailApi.listDrafts,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

// Common invalidator: any send/modify/trash should refresh the user's email lists
// (across all filters) and any open detail view. We invalidate broadly because the
// list queryKey is filter-specific and we don't want to leak that detail here.
function useGmailInvalidator() {
  const qc = useQueryClient()
  return (messageId?: string) => {
    qc.invalidateQueries({ queryKey: ['gmail', 'emails'] })
    qc.invalidateQueries({ queryKey: ['gmail', 'labels'] })
    qc.invalidateQueries({ queryKey: ['gmail', 'drafts'] })
    if (messageId) qc.invalidateQueries({ queryKey: ['gmail', 'email', messageId] })
  }
}

export function useSendMessage() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (input: ComposeInput) => gmailApi.sendMessage(input),
    onSuccess:  () => invalidate(),
  })
}

export function useReplyMessage() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (args: { sourceMessageId: string; input: ComposeInput; replyAll: boolean }) =>
      gmailApi.replyMessage(args.sourceMessageId, args.input, args.replyAll),
    onSuccess: (_data, vars) => invalidate(vars.sourceMessageId),
  })
}

export function useForwardMessage() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (args: {
      sourceMessageId:            string
      input:                      ComposeInput
      includeOriginalAttachments: boolean
    }) => gmailApi.forwardMessage(args.sourceMessageId, args.input, args.includeOriginalAttachments),
    onSuccess: (_data, vars) => invalidate(vars.sourceMessageId),
  })
}

export function useArchiveMessage() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (messageId: string) => gmailApi.archiveMessage(messageId),
    onSuccess:  (_d, id) => invalidate(id),
  })
}

export function useTrashMessage() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (messageId: string) => gmailApi.trashMessage(messageId),
    onSuccess:  (_d, id) => invalidate(id),
  })
}

export function useMarkRead() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (args: { messageId: string; read: boolean }) =>
      args.read ? gmailApi.markRead(args.messageId) : gmailApi.markUnread(args.messageId),
    onSuccess: (_d, vars) => invalidate(vars.messageId),
  })
}

export function useModifyLabels() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (args: { messageId: string; addLabelIds: string[]; removeLabelIds: string[] }) =>
      gmailApi.modifyLabels(args.messageId, args.addLabelIds, args.removeLabelIds),
    onSuccess: (_d, vars) => invalidate(vars.messageId),
  })
}

export function useSaveDraft() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (args: {
      input:           ComposeInput
      draftId:         string | null
      sourceMessageId: string | null
      replyAll:        boolean
    }) => gmailApi.saveDraft(args.input, args.draftId, args.sourceMessageId, args.replyAll),
    onSuccess: () => invalidate(),
  })
}

export function useSendDraft() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (draftId: string) => gmailApi.sendDraft(draftId),
    onSuccess:  () => invalidate(),
  })
}

export function useDeleteDraft() {
  const invalidate = useGmailInvalidator()
  return useMutation({
    mutationFn: (draftId: string) => gmailApi.deleteDraft(draftId),
    onSuccess:  () => invalidate(),
  })
}
