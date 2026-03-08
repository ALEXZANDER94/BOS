import axios from 'axios'

export interface EmailSummary {
  messageId:   string
  threadId:    string
  subject:     string
  snippet:     string
  fromAddress: string
  fromName:    string
  toAddresses: string
  receivedAt:  string
  isRead:      boolean
  clientId:    number | null
  clientName:  string | null
  contactId:   number | null
  contactName: string | null
}

export interface EmailDetail extends EmailSummary {
  ccAddresses: string | null
  bodyText:    string | null
  bodyHtml:    string | null
}

export interface EmailListResponse {
  emails:        EmailSummary[]
  nextPageToken: string | null
  totalEstimate: number
}

export interface GmailStatusDto {
  isConnected: boolean
  tokenExpiry: string | null
}

const BASE = '/api/gmail'

export const gmailApi = {
  getStatus: () =>
    axios.get<GmailStatusDto>(`${BASE}/status`).then(r => r.data),

  listEmails: (params?: { clientId?: number; alias?: string; pageToken?: string; q?: string }) =>
    axios.get<EmailListResponse>(`${BASE}/emails`, { params }).then(r => r.data),

  getEmail: (messageId: string) =>
    axios.get<EmailDetail>(`${BASE}/emails/${encodeURIComponent(messageId)}`).then(r => r.data),

  getAliases: () =>
    axios.get<string[]>(`${BASE}/aliases`).then(r => r.data),
}
