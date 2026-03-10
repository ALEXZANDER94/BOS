import { useEffect } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { Notification } from '@/api/notifications'

/**
 * Establishes a SignalR connection to /hubs/notifications for the duration of the
 * component's lifetime. Calls `onNotification` whenever the server pushes a new
 * notification to the current user.
 *
 * Uses cookie auth (withCredentials) — no extra token handling needed.
 * Reconnects automatically on transient failures.
 */
export function useSignalR(onNotification: (n: Notification) => void) {
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('notification', onNotification)

    connection.start().catch(err =>
      console.warn('[SignalR] Failed to connect:', err)
    )

    return () => {
      connection.stop()
    }
  // onNotification is intentionally excluded from the dependency array —
  // we capture it once on mount so the connection is stable for the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
