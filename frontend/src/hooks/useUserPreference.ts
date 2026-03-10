import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userPreferencesApi } from '@/api/userPreferences'

/**
 * Reads and writes a per-user preference stored on the backend.
 * The value is JSON-encoded, so T can be any serializable type.
 * Returns `defaultValue` until the preference is loaded or if it has never been set.
 */
export function useUserPreference<T>(key: string, defaultValue: T) {
  const qc = useQueryClient()

  const { data: raw } = useQuery({
    queryKey: ['user-preference', key],
    queryFn:  () => userPreferencesApi.get(key),
    staleTime: Infinity,
  })

  const value: T = raw != null ? (JSON.parse(raw) as T) : defaultValue

  const { mutate: setValue } = useMutation({
    mutationFn: (newValue: T) =>
      userPreferencesApi.set(key, JSON.stringify(newValue)),
    onMutate: async (newValue: T) => {
      await qc.cancelQueries({ queryKey: ['user-preference', key] })
      qc.setQueryData(['user-preference', key], JSON.stringify(newValue))
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['user-preference', key] })
    },
  })

  return { value, setValue }
}
