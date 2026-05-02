import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  useNotifications, useUnreadCount, useMarkRead, useMarkAllRead,
} from '@/hooks/useNotifications'
import { useSignalR } from '@/hooks/useSignalR'
import type { Notification } from '@/api/notifications'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0)    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification
  onRead:       (id: number) => void
}) {
  const navigate = useNavigate()

  function handleClick() {
    if (!notification.isRead) onRead(notification.id)
    if (notification.relatedTicketId) {
      navigate(`/tickets/${notification.relatedTicketId}`)
    } else if (notification.relatedProposalId) {
      navigate(`/proposals`)
    } else if (notification.relatedMessageId) {
      navigate(`/emails?select=${encodeURIComponent(notification.relatedMessageId)}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-blue-50/40 dark:bg-blue-950/20',
      )}
    >
      <div className="flex items-start gap-2">
        {!notification.isRead && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
        )}
        <div className={cn('min-w-0', notification.isRead && 'pl-4')}>
          <p className={cn('text-sm leading-snug', !notification.isRead && 'font-medium')}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {notification.body}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen]   = useState(false)
  const containerRef      = useRef<HTMLDivElement>(null)
  const qc                = useQueryClient()

  const { data: notifications = [] } = useNotifications()
  const { data: countData }          = useUnreadCount()
  const markRead                     = useMarkRead()
  const markAllRead                  = useMarkAllRead()

  const unreadCount = countData?.count ?? 0

  // Close when clicking outside
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [open])

  // Real-time push via SignalR
  useSignalR((incoming: Notification) => {
    // Optimistically inject the new notification into the cache
    qc.setQueryData<Notification[]>(['notifications'], prev =>
      prev ? [incoming, ...prev] : [incoming]
    )
    qc.setQueryData<{ count: number }>(['notifications-unread-count'], prev =>
      ({ count: (prev?.count ?? 0) + 1 })
    )

    // Show a toast in the bottom-right corner
    toast(incoming.title, {
      description: incoming.body,
      duration:    6000,
    })
  })

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          open && 'bg-muted text-foreground',
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onRead={id => markRead.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
