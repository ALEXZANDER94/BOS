import axios from 'axios'

export interface Notification {
  id:               number
  type:             string
  title:            string
  body:             string
  isRead:           boolean
  createdAt:        string
  relatedMessageId: string | null
  relatedNoteId:    number | null
  relatedTicketId:   number | null
  relatedProposalId: number | null
}

const BASE = '/api/notifications'

export const notificationsApi = {
  getAll: () =>
    axios.get<Notification[]>(BASE).then(r => r.data),

  getUnreadCount: () =>
    axios.get<{ count: number }>(`${BASE}/unread-count`).then(r => r.data),

  markRead: (id: number) =>
    axios.put(`${BASE}/${id}/read`).then(() => undefined),

  markAllRead: () =>
    axios.put(`${BASE}/read-all`).then(() => undefined),
}
