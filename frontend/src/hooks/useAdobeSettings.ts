import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '@/api/settings'

const QUERY_KEY = ['adobe-settings'] as const

export function useAdobeSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn:  settingsApi.getAdobeStatus,
    staleTime: 60_000, // Re-fetch at most once per minute
  })
}

export function useSetAdobeCredentials() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, clientSecret }: { clientId: string; clientSecret: string }) =>
      settingsApi.setAdobeCredentials(clientId, clientSecret),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Pro credentials saved. You are now on the Pro tier.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to save credentials.')
    },
  })
}

export function useClearAdobeCredentials() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.clearAdobeCredentials,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Pro credentials removed. Reverted to Free tier.')
    },
    onError: () => {
      toast.error('Failed to remove credentials.')
    },
  })
}
