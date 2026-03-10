import axios from 'axios'

export interface EmailNote {
  id:        number
  messageId: string
  userEmail: string
  noteText:  string
  createdAt: string
  updatedAt: string
}

export interface EmailNoteCounts {
  [messageId: string]: number
}

const BASE = '/api/email-notes'

export const emailNotesApi = {
  getNotes: (messageId: string) =>
    axios.get<EmailNote[]>(`${BASE}/${encodeURIComponent(messageId)}`).then(r => r.data),

  getNoteCounts: (messageIds: string[]) =>
    axios.get<EmailNoteCounts>(`${BASE}/counts`, {
      params: { messageIds: messageIds.join(',') },
    }).then(r => r.data),

  createNote: (messageId: string, noteText: string) =>
    axios.post<EmailNote>(`${BASE}/${encodeURIComponent(messageId)}`, { noteText }).then(r => r.data),

  updateNote: (noteId: number, noteText: string) =>
    axios.put<EmailNote>(`${BASE}/${noteId}`, { noteText }).then(r => r.data),

  deleteNote: (noteId: number) =>
    axios.delete(`${BASE}/${noteId}`),
}
