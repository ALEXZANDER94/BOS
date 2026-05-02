import { useQuery } from '@tanstack/react-query'
import { allProposalsApi } from '@/api/proposals'

export function useAllProposals(
  search?: string,
  status?: string,
  type?: string,
  clientId?: number,
  includeConverted = false,
) {
  return useQuery({
    queryKey: ['all-proposals', search, status, type, clientId, includeConverted],
    queryFn: () => allProposalsApi.getAll(search, status, type, clientId, includeConverted),
  })
}
