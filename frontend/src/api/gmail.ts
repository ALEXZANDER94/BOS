import axios from 'axios'

export interface EmailSummary {
  messageId:    string
  threadId:     string
  subject:      string
  snippet:      string
  fromAddress:  string
  fromName:     string
  toAddresses:  string
  receivedAt:   string
  isRead:       boolean
  clientId:     number | null
  clientName:   string | null
  contactId:    number | null
  contactName:  string | null
  rfcMessageId: string | null
}

export interface AttachmentMeta {
  attachmentId: string
  filename:     string
  mimeType:     string
  size:         number
}

export interface EmailDetail extends EmailSummary {
  ccAddresses: string | null
  bodyText:    string | null
  bodyHtml:    string | null
  attachments: AttachmentMeta[]
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

  listEmails: (params?: { clientId?: number; alias?: string; pageToken?: string; q?: string; maxResults?: number }) =>
    axios.get<EmailListResponse>(`${BASE}/emails`, { params }).then(r => r.data),

  getEmail: (messageId: string) =>
    axios.get<EmailDetail>(`${BASE}/emails/${encodeURIComponent(messageId)}`).then(r => r.data),

  getAliases: () =>
    axios.get<string[]>(`${BASE}/aliases`).then(r => r.data),

  getAttachmentUrl: (messageId: string, attachmentId: string, filename: string, mimeType: string) =>
    `${BASE}/message/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(attachmentId)}` +
    `?filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(mimeType)}`,

  // Resolves an RFC 2822 Message-ID (stable across all recipients) to the current user's
  // local Gmail message ID. Returns null if the message is not in the user's mailbox.
  findByRfcId: (rfcMessageId: string) =>
    axios.get<{ messageId: string }>(`${BASE}/find-message`, { params: { rfcMessageId } })
      .then(r => r.data)
      .catch(() => null),
}
