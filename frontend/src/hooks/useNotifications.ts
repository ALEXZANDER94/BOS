import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'

const POLL_INTERVAL = 30_000 // 30 s fallback polling; primary updates come via SignalR

export function useNotifications() {
  return useQuery({
    queryKey:        ['notifications'],
    queryFn:         notificationsApi.getAll,
    refetchInterval: POLL_INTERVAL,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey:        ['notifications-unread-count'],
    queryFn:         notificationsApi.getUnreadCount,
    refetchInterval: POLL_INTERVAL,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}
