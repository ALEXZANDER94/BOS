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
  getThread: (threadId: string) =>
    axios.get<EmailDetail[]>(`${BASE}/thread/${encodeURIComponent(threadId)}`).then(r => r.data),

  findByRfcId: (rfcMessageId: string) =>
    axios.get<{ messageId: string }>(`${BASE}/find-message`, { params: { rfcMessageId } })
      .then(r => r.data)
      .catch(() => null),

  // ── Compose / send / reply / forward ─────────────────────────────────────

  sendMessage: (input: ComposeInput) =>
    axios.post<SendResult>(`${BASE}/messages/send`, buildComposeForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  replyMessage: (sourceMessageId: string, input: ComposeInput, replyAll: boolean) => {
    const fd = buildComposeForm(input)
    fd.append('replyAll', String(replyAll))
    return axios.post<SendResult>(
      `${BASE}/messages/${encodeURIComponent(sourceMessageId)}/reply`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data)
  },

  forwardMessage: (sourceMessageId: string, input: ComposeInput, includeOriginalAttachments: boolean) => {
    const fd = buildComposeForm(input)
    fd.append('includeOriginalAttachments', String(includeOriginalAttachments))
    return axios.post<SendResult>(
      `${BASE}/messages/${encodeURIComponent(sourceMessageId)}/forward`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data)
  },

  // ── Labels / archive / trash / read state ────────────────────────────────

  listLabels: () =>
    axios.get<GmailLabel[]>(`${BASE}/labels`).then(r => r.data),

  modifyLabels: (messageId: string, addLabelIds: string[], removeLabelIds: string[]) =>
    axios.patch(
      `${BASE}/messages/${encodeURIComponent(messageId)}/labels`,
      { addLabelIds, removeLabelIds },
    ),

  trashMessage: (messageId: string) =>
    axios.post(`${BASE}/messages/${encodeURIComponent(messageId)}/trash`),

  untrashMessage: (messageId: string) =>
    axios.post(`${BASE}/messages/${encodeURIComponent(messageId)}/untrash`),

  markRead: (messageId: string) =>
    axios.post(`${BASE}/messages/${encodeURIComponent(messageId)}/read`),

  markUnread: (messageId: string) =>
    axios.post(`${BASE}/messages/${encodeURIComponent(messageId)}/unread`),

  // Convenience: removing INBOX is how Gmail "archives" — keep it on the api so callers
  // don't have to remember the magic label id.
  archiveMessage: (messageId: string) =>
    axios.patch(
      `${BASE}/messages/${encodeURIComponent(messageId)}/labels`,
      { addLabelIds: [], removeLabelIds: ['INBOX'] },
    ),

  // ── Drafts ────────────────────────────────────────────────────────────────

  listDrafts: () =>
    axios.get<DraftListResponse>(`${BASE}/drafts`).then(r => r.data),

  getDraft: (draftId: string) =>
    axios.get<DraftDetail>(`${BASE}/drafts/${encodeURIComponent(draftId)}`).then(r => r.data),

  saveDraft: (input: ComposeInput, draftId: string | null, sourceMessageId: string | null, replyAll: boolean) => {
    const fd = buildComposeForm(input)
    if (draftId)         fd.append('draftId', draftId)
    if (sourceMessageId) fd.append('sourceMessageId', sourceMessageId)
    fd.append('replyAll', String(replyAll))
    return axios.post<DraftSaved>(`${BASE}/drafts`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  sendDraft: (draftId: string) =>
    axios.post<SendResult>(`${BASE}/drafts/${encodeURIComponent(draftId)}/send`).then(r => r.data),

  deleteDraft: (draftId: string) =>
    axios.delete(`${BASE}/drafts/${encodeURIComponent(draftId)}`),
}

// ── Compose types ─────────────────────────────────────────────────────────────

// Shared shape used by send / reply / forward / save-draft. Files are real File objects
// from an <input type="file"> picker; the API helper converts them into multipart parts.
export interface ComposeInput {
  to:       string
  cc?:      string
  bcc?:     string
  subject:  string
  bodyHtml: string
  bodyText?: string
  attachments?: File[]
  from?: string
}

export interface SendResult {
  messageId: string
  threadId:  string
}

export interface GmailLabel {
  id:          string
  name:        string
  type:        'system' | 'user'
  unreadCount: number | null
  totalCount:  number | null
}

export interface DraftSummary {
  draftId:   string
  messageId: string
  threadId:  string
  subject:   string
  to:        string
  snippet:   string | null
  updatedAt: string
}

export interface DraftDetail {
  draftId:            string
  messageId:          string
  threadId:           string
  subject:            string
  to:                 string
  cc:                 string | null
  bcc:                string | null
  bodyHtml:           string | null
  bodyText:           string | null
  attachments:        AttachmentMeta[]
  inReplyToMessageId: string | null
  updatedAt:          string
}

export interface DraftListResponse {
  drafts: DraftSummary[]
}

export interface DraftSaved {
  draftId:   string
  messageId: string
  threadId:  string
}

// Builds a FormData payload from a ComposeInput. The backend expects:
//   to, cc, bcc, subject, bodyHtml, bodyText (text fields)
//   attachments (one or more File parts under the same field name)
function buildComposeForm(input: ComposeInput): FormData {
  const fd = new FormData()
  fd.append('to',       input.to       ?? '')
  fd.append('cc',       input.cc       ?? '')
  fd.append('bcc',      input.bcc      ?? '')
  fd.append('subject',  input.subject  ?? '')
  fd.append('bodyHtml', input.bodyHtml ?? '')
  if (input.bodyText) fd.append('bodyText', input.bodyText)
  if (input.from) fd.append('from', input.from)
  if (input.attachments) {
    for (const f of input.attachments) fd.append('attachments', f, f.name)
  }
  return fd
}
