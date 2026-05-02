import axios from 'axios'

export interface EmailSignature {
  id:             number
  ownerUserEmail: string
  aliasEmail:     string | null
  name:           string
  bodyHtml:       string
  isDefault:      boolean
  createdAt:      string
  updatedAt:      string
}

export interface SendAsAddress {
  email:       string
  displayName: string | null
  isDefault:   boolean
  isPrimary:   boolean
}

const BASE = '/api/email-signatures'

export const emailSignatureApi = {
  list: () =>
    axios.get<EmailSignature[]>(BASE).then(r => r.data),

  getForAlias: (alias?: string | null) =>
    axios.get<EmailSignature | null>(`${BASE}/for-alias`, { params: { alias: alias ?? undefined } }).then(r => r.data),

  create: (data: {
    aliasEmail?: string | null
    name:        string
    bodyHtml:    string
    isDefault:   boolean
  }) => axios.post<EmailSignature>(BASE, data).then(r => r.data),

  update: (id: number, data: {
    aliasEmail?: string | null
    name:        string
    bodyHtml:    string
    isDefault:   boolean
  }) => axios.put<EmailSignature>(`${BASE}/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    axios.delete(`${BASE}/${id}`),

  getSendAsAddresses: () =>
    axios.get<SendAsAddress[]>('/api/gmail/send-as').then(r => r.data),
}
