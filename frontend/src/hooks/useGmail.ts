import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gmailApi } from '@/api/gmail'

// ── Filter type ───────────────────────────────────────────────────────────────

export type EmailFilter =
  | { type: 'all' }
  | { type: 'client';  id: number }
  | { type: 'alias';   address: string }
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

export function useEmails(filter: EmailFilter = { type: 'all' }, search?: string) {
  return useQuery({
    queryKey: ['gmail', 'emails', filter, search ?? ''],
    queryFn:  () => {
      const params: Parameters<typeof gmailApi.listEmails>[0] = {}
      if (filter.type === 'client')  params.clientId = filter.id
      if (filter.type === 'alias')   params.alias    = filter.address
      if (search)                    params.q        = search
      return gmailApi.listEmails(params)
    },
    // Category-filtered emails are fetched via the assignments API, not Gmail directly
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
