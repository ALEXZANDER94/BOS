import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/workspace'

/**
 * Returns the list of workspace users available to @-mention.
 * When `alias` is provided, restricts the list to members of that alias group.
 * Cached for the entire session — workspace membership is stable within a session.
 */
export function useWorkspaceUsers(alias?: string) {
  return useQuery({
    queryKey: ['workspace-users', alias ?? 'all'],
    queryFn:  () => workspaceApi.getUsers(alias),
    staleTime: Infinity,
  })
}
