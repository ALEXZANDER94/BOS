import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ticketApi } from '@/api/tickets'
import {
  RefreshCw, Mail, MailOpen, AlertCircle, Inbox, Search, X,
  Settings2, Eye, EyeOff, ChevronDown, ChevronUp, Paperclip, TicketCheck,
  Reply, ReplyAll, Forward, Archive, Trash2, MailMinus, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useEmails, useEmailDetail, useRefreshEmails, useGmailStatus, useGmailAliases,
  useArchiveMessage, useTrashMessage, useMarkRead,
  type EmailFilter,
} from '@/hooks/useGmail'
import { ComposeDialog, type ComposeMode } from '@/components/email/ComposeDialog'
import { gmailApi } from '@/api/gmail'
import { useClients } from '@/hooks/useClients'
import {
  useEmailCategories, useEmailAssignmentsBatch, useCategoryEmails,
} from '@/hooks/useEmailCategories'
import { useUserPreference } from '@/hooks/useUserPreference'
import { CategoryManagementDialog } from '@/components/email/CategoryManagementDialog'
import { EmailAssignmentPanel } from '@/components/email/EmailAssignmentPanel'
import { EmailNotesPanel } from '@/components/email/EmailNotesPanel'
import { AddToBosButton } from '@/components/email/AddToBosButton'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'
import { emailNotesApi, type EmailNoteCounts } from '@/api/emailNotes'
import type { EmailSummary } from '@/api/gmail'
import type { EmailAssignment } from '@/api/emailCategories'
import type { Client } from '@/api/clients'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function displayName(email: EmailSummary) {
  return email.fromName || email.fromAddress
}

function filterLabel(
  filter:     EmailFilter,
  clients:    { id: number; name: string }[],
  categories: { id: number; name: string }[],
) {
  if (filter.type === 'all')      return 'All Emails'
  if (filter.type === 'client')   return clients.find(c => c.id === filter.id)?.name ?? 'Emails'
  if (filter.type === 'alias')    return filter.address
  if (filter.type === 'category') return categories.find(c => c.id === filter.id)?.name ?? 'Category'
  return 'All Emails'
}

// Parses "Display Name <email@example.com>" or bare "email@example.com"
function parseEmailAddress(raw: string): { address: string; name: string } {
  raw = raw.trim()
  const lt = raw.indexOf('<')
  if (lt >= 0 && raw.endsWith('>')) {
    return {
      name:    raw.slice(0, lt).trim().replace(/^"|"$/g, ''),
      address: raw.slice(lt + 1, -1).trim(),
    }
  }
  return { address: raw, name: '' }
}

// ── Sidebar button ────────────────────────────────────────────────────────────

function SidebarBtn({
  active, onClick, children, dot,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
  dot?:     string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors flex items-center gap-2 truncate',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted'
      )}
    >
      {dot && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
      <span className="truncate">{children}</span>
    </button>
  )
}

// ── Email list item ───────────────────────────────────────────────────────────

function EmailRow({
  email, isSelected, assignment, noteCount, threadCount, onClick,
}: {
  email:        EmailSummary
  isSelected:   boolean
  assignment?:  EmailAssignment
  noteCount?:   number
  threadCount?: number
  onClick:      () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors',
        isSelected  ? 'bg-accent' : 'hover:bg-muted/50',
        !email.isRead && 'bg-blue-50/40 dark:bg-blue-950/20'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className={cn('text-sm truncate flex items-center gap-1.5', !email.isRead && 'font-semibold')}>
          <span className="truncate">{displayName(email)}</span>
          {threadCount && threadCount > 1 && (
            <span
              className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] leading-none px-1.5 py-0.5 shrink-0"
              title={`${threadCount} messages in this thread`}
            >
              {threadCount}
            </span>
          )}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {formatDate(email.receivedAt)}
        </span>
      </div>
      <p className={cn('text-sm truncate', !email.isRead ? 'font-medium' : 'text-muted-foreground')}>
        {email.subject}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {email.snippet}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        {email.clientName && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {email.clientName}
          </Badge>
        )}
        {!email.clientId && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
            Unmatched
          </Badge>
        )}
        {assignment && (
          <>
            <Badge
              className="text-[10px] h-4 px-1.5 border-none"
              style={{ backgroundColor: assignment.categoryColor, color: '#fff' }}
            >
              {assignment.categoryName}
            </Badge>
            {assignment.statusName && (
              <Badge
                className="text-[10px] h-4 px-1.5 border-none"
                style={{
                  backgroundColor: assignment.statusColor ?? assignment.categoryColor,
                  color: '#fff',
                }}
              >
                {assignment.statusName}
              </Badge>
            )}
          </>
        )}
        {noteCount != null && noteCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {noteCount} note{noteCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Email detail panel ────────────────────────────────────────────────────────

function ToField({
  raw,
  clients,
}: {
  raw:     string
  clients: Client[]
}) {
  const [expanded, setExpanded] = useState(false)
  const parts   = raw.split(',').map(s => s.trim()).filter(Boolean)
  const visible = expanded ? parts : parts.slice(0, 1)
  const hidden  = parts.length - 1

  return (
    <p className="flex flex-wrap items-center gap-x-1">
      <span className="font-medium text-foreground">To:</span>
      {visible.map((raw, i) => {
        const { address, name } = parseEmailAddress(raw)
        return (
          <span key={i} className="inline-flex items-center gap-0.5">
            {i > 0 && <span className="text-muted-foreground">,</span>}
            <span>{raw}</span>
            <AddToBosButton address={address} name={name} clients={clients} />
          </span>
        )
      })}
      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          <ChevronDown className="h-3 w-3" />
          +{hidden} more
        </button>
      )}
      {expanded && parts.length > 1 && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          <ChevronUp className="h-3 w-3" />
          show less
        </button>
      )}
    </p>
  )
}

function EmailDetailPanel({
  messageId,
  noteKey,
  clients,
  onAfterRemove,
}: {
  messageId: string
  noteKey?:  string
  clients:   Client[]
  onAfterRemove: () => void
}) {
  const navigate = useNavigate()
  const [createTicketOpen, setCreateTicketOpen] = useState(false)
  const [inlineMode, setInlineMode] = useState<ComposeMode | null>(null)
  const [inlineMsgId, setInlineMsgId] = useState(messageId)
  const { data: detail, isLoading } = useEmailDetail(messageId)
  const archiveMut  = useArchiveMessage()
  const trashMut    = useTrashMessage()
  const markReadMut = useMarkRead()

  const { data: threadMessages } = useQuery({
    queryKey: ['gmail', 'thread', detail?.threadId],
    queryFn:  () => gmailApi.getThread(detail!.threadId),
    enabled:  !!detail?.threadId && !!inlineMode,
  })

  // Reset inline mode when switching emails — derived from prop, no effect needed
  if (messageId !== inlineMsgId) {
    setInlineMode(null)
    setInlineMsgId(messageId)
  }

  // Look up tickets already linked to this email (uses RFC Message-ID when available
  // — same value the create-ticket dialog stores).
  const linkedKey = detail?.rfcMessageId ?? messageId
  const { data: linkedTickets = [] } = useQuery({
    queryKey: ['email-tickets', linkedKey],
    queryFn:  () => ticketApi.getByEmail(linkedKey),
    enabled:  !!detail,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Could not load email.
      </div>
    )
  }

  async function handleArchive() {
    try {
      await archiveMut.mutateAsync(messageId)
      toast.success('Archived')
      onAfterRemove()
    } catch { toast.error('Archive failed') }
  }
  async function handleTrash() {
    try {
      await trashMut.mutateAsync(messageId)
      toast.success('Moved to trash')
      onAfterRemove()
    } catch { toast.error('Trash failed') }
  }
  async function handleMarkUnread() {
    try {
      await markReadMut.mutateAsync({ messageId, read: false })
      toast.success('Marked unread')
    } catch { toast.error('Mark unread failed') }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/20">
        <Button size="sm" variant={inlineMode === 'reply' ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs"
          onClick={() => setInlineMode(inlineMode === 'reply' ? null : 'reply')}
          title="Reply"
        >
          <Reply className="h-3.5 w-3.5 mr-1" /> Reply
        </Button>
        <Button size="sm" variant={inlineMode === 'replyAll' ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs"
          onClick={() => setInlineMode(inlineMode === 'replyAll' ? null : 'replyAll')}
          title="Reply all"
        >
          <ReplyAll className="h-3.5 w-3.5 mr-1" /> Reply all
        </Button>
        <Button size="sm" variant={inlineMode === 'forward' ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs"
          onClick={() => setInlineMode(inlineMode === 'forward' ? null : 'forward')}
          title="Forward"
        >
          <Forward className="h-3.5 w-3.5 mr-1" /> Forward
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={handleArchive}
          disabled={archiveMut.isPending}
          title="Archive"
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={handleTrash}
          disabled={trashMut.isPending}
          title="Move to trash"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={handleMarkUnread}
          disabled={markReadMut.isPending}
          title="Mark unread"
        >
          <MailMinus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Inline compose (reply / forward) */}
      {inlineMode && detail && (
        <ComposeDialog
          open={true}
          onClose={() => setInlineMode(null)}
          mode={inlineMode}
          source={detail}
          inline
        />
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b border-border space-y-1">
        <h3 className="text-base font-semibold leading-snug">{detail.subject}</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1 flex-wrap">
            <span className="font-medium text-foreground">From:</span>
            <span>
              {detail.fromName
                ? `${detail.fromName} <${detail.fromAddress}>`
                : detail.fromAddress}
            </span>
            <AddToBosButton
              address={detail.fromAddress}
              name={detail.fromName}
              clients={clients}
            />
          </p>
          <ToField raw={detail.toAddresses} clients={clients} />
          {detail.ccAddresses && (
            <p>
              <span className="font-medium text-foreground">Cc:</span>{' '}
              {detail.ccAddresses}
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Date:</span>{' '}
            {new Date(detail.receivedAt).toLocaleString()}
          </p>
          {detail.clientName && (
            <p>
              <span className="font-medium text-foreground">Client:</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                {detail.clientName}
              </Badge>
            </p>
          )}
          <div className="pt-0.5">
            <EmailAssignmentPanel messageId={messageId} noteKey={noteKey} />
          </div>
          {linkedTickets.length > 0 && (
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <TicketCheck className="h-3.5 w-3.5" />
                {linkedTickets.length} ticket{linkedTickets.length !== 1 ? 's' : ''} linked:
              </span>
              {linkedTickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  title={t.title}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 transition-colors"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.statusColor }}
                  />
                  <span className="font-mono">{t.ticketNumber}</span>
                  <span className="max-w-[140px] truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="pt-1">
            <button
              onClick={() => setCreateTicketOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <TicketCheck className="h-3.5 w-3.5" />
              {linkedTickets.length > 0 ? 'Create Another Ticket' : 'Create Ticket from Email'}
            </button>
          </div>
          {detail.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {detail.attachments.map(att => (
                <a
                  key={att.attachmentId}
                  href={gmailApi.getAttachmentUrl(messageId, att.attachmentId, att.filename, att.mimeType)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
                >
                  <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate max-w-[160px]">{att.filename}</span>
                  <span className="text-muted-foreground shrink-0">{fmtSize(att.size)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body / Thread */}
      <div className="flex-1 overflow-auto">
        {inlineMode && threadMessages && threadMessages.length > 0 ? (
          // Thread view: show all messages when inline compose is active
          <div className="divide-y divide-border">
            {threadMessages.map((msg, i) => (
              <div key={msg.messageId} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {msg.fromName || msg.fromAddress}
                    </span>
                    <span className="mx-1.5">to</span>
                    <span>{msg.toAddresses}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(msg.receivedAt).toLocaleString()}
                  </span>
                </div>
                {msg.bodyHtml ? (
                  <iframe
                    srcDoc={msg.bodyHtml}
                    sandbox="allow-same-origin"
                    className="w-full border-none"
                    style={{ minHeight: i === threadMessages.length - 1 ? 200 : 120 }}
                    title={`Thread message ${i + 1}`}
                  />
                ) : msg.bodyText ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.bodyText}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          // Single message view
          <div className="px-5 py-4 h-full">
            {detail.bodyHtml ? (
              <iframe
                srcDoc={detail.bodyHtml}
                sandbox="allow-same-origin"
                className="w-full h-full border-none"
                title="Email body"
              />
            ) : detail.bodyText ? (
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {detail.bodyText}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No body content.</p>
            )}
          </div>
        )}
      </div>

      <CreateTicketDialog
        open={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        prefill={{
          title:                detail.subject || '',
          linkedEmailMessageId: detail.rfcMessageId ?? messageId,
          linkedEmailSubject:   detail.subject || '',
        }}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const [searchParams, setSearchParams]           = useSearchParams()
  const [filter, setFilter]                       = useState<EmailFilter>({ type: 'all' })
  const [selectedStatusId, setSelectedStatusId]   = useState<number | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [searchInput, setSearchInput]             = useState('')
  const [search, setSearch]                       = useState('')
  const [isEditingAliases, setIsEditingAliases]   = useState(false)

  // Compose dialog state. `composeSourceId` drives reply/replyAll/forward; we look up
  // the full EmailDetail off the active selection so the dialog can build a quoted body.
  const [composeOpen,     setComposeOpen]     = useState(false)
  const [composeMode,     setComposeMode]     = useState<ComposeMode>('new')
  const [composeSourceId, setComposeSourceId] = useState<string | null>(null)
  const { data: composeSource } = useEmailDetail(
    composeOpen && composeMode !== 'new' ? composeSourceId : null,
  )

  function openCompose(mode: ComposeMode, sourceMessageId: string | null = null) {
    setComposeMode(mode)
    setComposeSourceId(sourceMessageId)
    setComposeOpen(true)
  }

  // Deep-link from notification: /emails?select=<id>
  // The id may be a Gmail-internal message ID (hex) or an RFC 2822 Message-ID (contains '@').
  // RFC Message-IDs are used as the stable cross-user note key. We resolve them to the current
  // user's local Gmail ID before selecting so the email body loads from their own mailbox.
  useEffect(() => {
    const sel = searchParams.get('select')
    if (!sel) return
    setSearchParams({}, { replace: true })

    if (sel.includes('@')) {
      // Looks like an RFC Message-ID — resolve to this user's Gmail ID first
      gmailApi.findByRfcId(sel).then(res => {
        if (res?.messageId) setSelectedMessageId(res.messageId)
      })
    } else {
      setSelectedMessageId(sel)
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // User preferences
  const { value: pageSize, setValue: setPageSize }         = useUserPreference<number>('email-page-size', 25)
  const { value: hiddenAliases, setValue: setHiddenAliases } = useUserPreference<string[]>('hidden-aliases', [])

  // Debounce search input 300 ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: status }          = useGmailStatus()
  const { data: aliases = [] }    = useGmailAliases()
  const { data: clients = [] }    = useClients()
  const { data: categories = [] } = useEmailCategories()

  // Standard Gmail email fetch (uses infinite query for load-more)
  const {
    data: gmailData,
    isLoading: gmailLoading,
    dataUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEmails(filter, search || undefined, pageSize)

  // Category-filtered email fetch (assignments DB → Gmail by IDs)
  const { data: categoryData, isLoading: categoryLoading } =
    useCategoryEmails(filter.type === 'category' ? filter.id : null)

  const refresh = useRefreshEmails(filter, search || undefined)

  // Unified email list depending on active filter
  const allEmails: EmailSummary[] = filter.type === 'category'
    ? (categoryData?.emails ?? [])
    : (gmailData?.pages.flatMap(p => p.emails) ?? [])

  const isLoading = filter.type === 'category' ? categoryLoading : gmailLoading

  // Build a list of stable note keys (RFC Message-IDs preferred, Gmail ID as fallback).
  // Notes are stored under RFC Message-IDs so all group members share the same note set.
  const noteKeys = useMemo(
    () => allEmails.map(e => e.rfcMessageId ?? e.messageId),
    [allEmails]
  )
  // Map each email's note key back to its Gmail message ID so the row can display the count.
  const rfcToGmailId = useMemo(
    () => Object.fromEntries(allEmails.map(e => [e.rfcMessageId ?? e.messageId, e.messageId])),
    [allEmails]
  )

  // Batch-load assignments using stable note keys (RFC Message-IDs preferred).
  // Assignments are stored under RFC IDs so all group members share the same assignment.
  const { data: batchAssignments = [] } = useEmailAssignmentsBatch(noteKeys)

  // Pre-build a Gmail messageId → assignment map for O(1) lookup.
  // batchAssignments use RFC IDs as messageId; re-key to Gmail IDs via rfcToGmailId.
  const assignmentMap = useMemo(() =>
    Object.fromEntries(
      batchAssignments.map(a => [rfcToGmailId[a.messageId] ?? a.messageId, a])
    ),
    [batchAssignments, rfcToGmailId])
  const noteCountKeys = noteKeys.join(',')
  const { data: noteCountsByKey = {} } = useQuery<EmailNoteCounts>({
    queryKey: ['email-note-counts', noteCountKeys],
    queryFn:  () => emailNotesApi.getNoteCounts(noteKeys),
    enabled:  noteKeys.length > 0,
  })
  // Re-key by Gmail message ID so EmailRow lookups work unchanged
  const noteCounts = useMemo(
    () => Object.fromEntries(
      Object.entries(noteCountsByKey).map(([k, v]) => [rfcToGmailId[k] ?? k, v])
    ),
    [noteCountsByKey, rfcToGmailId]
  )

  // Category assignments already returned by useCategoryEmails.
  // Stored messageId values may be RFC IDs; re-key to Gmail IDs for row lookups.
  const categoryAssignmentMap = useMemo(() => {
    if (filter.type !== 'category' || !categoryData) return {}
    return Object.fromEntries(
      categoryData.assignments.map(a => [rfcToGmailId[a.messageId] ?? a.messageId, a])
    )
  }, [filter, categoryData, rfcToGmailId])

  const effectiveAssignmentMap = filter.type === 'category'
    ? categoryAssignmentMap
    : assignmentMap

  // Apply status sub-filter (only when viewing a category)
  const emails: EmailSummary[] = filter.type === 'category' && selectedStatusId !== null
    ? allEmails.filter(e => effectiveAssignmentMap[e.messageId]?.statusId === selectedStatusId)
    : allEmails

  // Collapse by Gmail threadId so a reply doesn't produce a second row for the same conversation.
  // Representative row = most-recent message in the thread; counts/flags aggregate across the
  // thread so a note on an older message or an assignment on a newer one still surfaces.
  const threadGroups = useMemo(() => {
    const byThread = new Map<string, {
      representative: EmailSummary
      messageIds:     string[]
      count:          number
      anyUnread:      boolean
      noteCountSum:   number
      assignment?:    EmailAssignment
      assignmentAt:   number          // receivedAt of the message the assignment came from
    }>()

    for (const e of emails) {
      const threadKey   = e.threadId || e.messageId
      const receivedMs  = new Date(e.receivedAt).getTime()
      const msgNotes    = noteCounts[e.messageId] ?? 0
      const msgAssign   = effectiveAssignmentMap[e.messageId]

      const existing = byThread.get(threadKey)
      if (!existing) {
        byThread.set(threadKey, {
          representative: e,
          messageIds:     [e.messageId],
          count:          1,
          anyUnread:      !e.isRead,
          noteCountSum:   msgNotes,
          assignment:     msgAssign,
          assignmentAt:   msgAssign ? receivedMs : -Infinity,
        })
      } else {
        existing.messageIds.push(e.messageId)
        existing.count       += 1
        existing.anyUnread    = existing.anyUnread || !e.isRead
        existing.noteCountSum += msgNotes
        // Keep the freshest message as the row representative.
        if (receivedMs > new Date(existing.representative.receivedAt).getTime()) {
          existing.representative = e
        }
        // Prefer the most-recent assignment across the thread.
        if (msgAssign && receivedMs >= existing.assignmentAt) {
          existing.assignment   = msgAssign
          existing.assignmentAt = receivedMs
        }
      }
    }

    return Array.from(byThread.values())
      .sort((a, b) =>
        new Date(b.representative.receivedAt).getTime() -
        new Date(a.representative.receivedAt).getTime()
      )
  }, [emails, effectiveAssignmentMap, noteCounts])

  // Fast membership lookup so a thread row highlights whenever *any* of its messages
  // is the currently selected one (supports deep-links to specific messages inside a thread).
  const selectedThreadId = useMemo(() => {
    if (!selectedMessageId) return null
    return emails.find(e => e.messageId === selectedMessageId)?.threadId ?? null
  }, [selectedMessageId, emails])

  // Fetch the detail of the currently selected email when its summary isn't in the list
  // (e.g. deep-link from a ticket to an older email). Gives us a reliable source of the RFC
  // Message-ID for note-key resolution. Skipped when the summary is already available to
  // avoid a redundant fetch — EmailDetailPanel has its own useEmailDetail which will still
  // run for body rendering, and react-query will dedupe if the request is needed.
  const needsDetailFallback = !!selectedMessageId
    && !allEmails.some(e => e.messageId === selectedMessageId)
  const { data: detailFallback } = useEmailDetail(needsDetailFallback ? selectedMessageId : null)

  const lastFetched = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Aliases after hiding user-hidden ones
  const visibleAliases = aliases.filter(a => !hiddenAliases.includes(a))

  function selectFilter(f: EmailFilter) {
    setFilter(f)
    setSelectedStatusId(null)
    setSelectedMessageId(null)
    setSearchInput('')
  }

  function toggleAlias(address: string) {
    if (hiddenAliases.includes(address)) {
      setHiddenAliases(hiddenAliases.filter(a => a !== address))
    } else {
      setHiddenAliases([...hiddenAliases, address])
    }
  }

  // Not connected state
  if (status && !status.isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Gmail not connected</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Sign out and sign back in to grant BOS access to your Gmail account.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-6 -mt-6">

      {/* ── Filter sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">

        {/* Inboxes */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inboxes
          </p>
          {aliases.length > 0 && (
            <button
              onClick={() => setIsEditingAliases(v => !v)}
              title={isEditingAliases ? 'Done' : 'Show/hide aliases'}
              className={cn(
                'rounded p-0.5 transition-colors',
                isEditingAliases
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <nav className="p-2 space-y-0.5 border-b border-border">
          <SidebarBtn
            active={filter.type === 'all'}
            onClick={() => selectFilter({ type: 'all' })}
          >
            All Emails
          </SidebarBtn>

          {isEditingAliases ? (
            // Edit mode: show all aliases with eye toggles
            aliases.map(address => (
              <div key={address} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted">
                <span className={cn(
                  'text-sm flex-1 truncate',
                  hiddenAliases.includes(address) ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground',
                )}>
                  {address}
                </span>
                <button
                  onClick={() => toggleAlias(address)}
                  title={hiddenAliases.includes(address) ? 'Show alias' : 'Hide alias'}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {hiddenAliases.includes(address)
                    ? <EyeOff className="h-3.5 w-3.5" />
                    : <Eye    className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            ))
          ) : (
            // Normal mode: only visible aliases
            visibleAliases.map(address => (
              <SidebarBtn
                key={address}
                active={filter.type === 'alias' && filter.address === address}
                onClick={() => selectFilter({ type: 'alias', address })}
              >
                {address}
              </SidebarBtn>
            ))
          )}

          {!isEditingAliases && hiddenAliases.length > 0 && (
            <p className="px-3 pt-1 text-[10px] text-muted-foreground/50">
              {hiddenAliases.length} alias{hiddenAliases.length !== 1 ? 'es' : ''} hidden
            </p>
          )}
        </nav>

        {/* Categories */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Categories
          </p>
          <CategoryManagementDialog />
        </div>
        <nav className="p-2 space-y-0.5 border-b border-border">
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-1">No categories</p>
          ) : (
            categories.map(c => (
              <SidebarBtn
                key={c.id}
                active={filter.type === 'category' && filter.id === c.id}
                onClick={() => selectFilter({ type: 'category', id: c.id })}
                dot={c.color}
              >
                {c.name}
              </SidebarBtn>
            ))
          )}
        </nav>

        {/* Clients */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Clients
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {clients.map(c => (
            <SidebarBtn
              key={c.id}
              active={filter.type === 'client' && filter.id === c.id}
              onClick={() => selectFilter({ type: 'client', id: c.id })}
            >
              {c.name}
            </SidebarBtn>
          ))}
        </nav>
      </aside>

      {/* ── Email list ── */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* List header */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {filterLabel(filter, clients, categories)}
              </p>
              {lastFetched && filter.type !== 'category' && (
                <p className="text-[11px] text-muted-foreground">Updated {lastFetched}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Compose new */}
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openCompose('new', null)}
                title="Compose new email"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Compose
              </Button>
              {/* Page size selector */}
              {filter.type !== 'category' && (
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="text-[11px] text-muted-foreground bg-transparent border border-border rounded px-1 py-0.5 cursor-pointer hover:border-foreground transition-colors focus:outline-none"
                  title="Emails per page"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              )}
              {filter.type !== 'category' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => refresh()}
                  title="Refresh"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                </Button>
              )}
            </div>
          </div>
          {filter.type !== 'category' ? (
            <div className="px-3 pb-2.5 relative">
              <Search className="absolute left-5.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search emails…"
                className="h-7 pl-7 pr-7 text-xs"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (() => {
            const activeCat = categories.find(c => c.id === (filter as { type: 'category'; id: number }).id)
            if (!activeCat || activeCat.statuses.length === 0) return null
            return (
              <div className="px-3 pb-2.5">
                <select
                  value={selectedStatusId ?? ''}
                  onChange={e => {
                    const val = e.target.value
                    setSelectedStatusId(val === '' ? null : Number(val))
                    setSelectedMessageId(null)
                  }}
                  className="w-full h-7 text-xs text-muted-foreground bg-transparent border border-border rounded px-2 cursor-pointer hover:border-foreground transition-colors focus:outline-none"
                >
                  <option value="">All statuses</option>
                  {activeCat.statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )
          })()}
        </div>

        {/* Email rows */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : threadGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No emails found.</p>
            </div>
          ) : (
            <>
              {threadGroups.map(group => {
                const rep          = group.representative
                const rowIsUnread  = group.anyUnread
                const effectiveRep = rowIsUnread === rep.isRead
                  ? { ...rep, isRead: !rowIsUnread }
                  : rep
                return (
                  <EmailRow
                    key={rep.threadId || rep.messageId}
                    email={effectiveRep}
                    isSelected={selectedThreadId
                      ? (rep.threadId || rep.messageId) === selectedThreadId
                      : selectedMessageId === rep.messageId}
                    assignment={group.assignment}
                    noteCount={group.noteCountSum}
                    threadCount={group.count}
                    onClick={() => setSelectedMessageId(rep.messageId)}
                  />
                )
              })}
              {/* Load more */}
              {hasNextPage && filter.type !== 'category' && (
                <div className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Unread / total count — counts are over threads, matching what the user sees */}
        {threadGroups.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {threadGroups.filter(g => g.anyUnread).length} unread
            </span>
            <span className="flex items-center gap-1">
              <MailOpen className="h-3 w-3" />
              {threadGroups.length} shown
            </span>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      <div className="flex-1 flex overflow-hidden">
        {composeOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ComposeDialog
              open={true}
              onClose={() => setComposeOpen(false)}
              mode={composeMode}
              source={composeMode !== 'new' ? composeSource ?? undefined : undefined}
              inline
            />
          </div>
        ) : selectedMessageId ? (() => {
          const selectedEmail = allEmails.find(e => e.messageId === selectedMessageId)
          // Fall back to the email's detail when the list summary is unavailable (e.g. deep-link
          // from a ticket/notification to an email outside the current page). The detail is
          // already fetched by EmailDetailPanel — react-query dedupes the request. Without this,
          // noteKey would be undefined and EmailNotesPanel would silently shard notes under the
          // per-user Gmail message-ID instead of the stable RFC Message-ID.
          const noteKey = selectedEmail?.rfcMessageId
                        ?? detailFallback?.rfcMessageId
                        ?? undefined
          // When not explicitly filtering by alias, try to detect which alias
          // the email was addressed to so mention autocomplete still shows group members.
          const detectedAlias = filter.type !== 'alias'
            ? aliases.find(a => selectedEmail?.toAddresses?.toLowerCase().includes(a.toLowerCase()))
            : undefined
          const effectiveAliasFilter = filter.type === 'alias' ? filter.address : detectedAlias
          return (
          <>
            <div className="flex-1 flex flex-col overflow-hidden">
              <EmailDetailPanel
                messageId={selectedMessageId}
                noteKey={noteKey}
                clients={clients}
                onAfterRemove={() => setSelectedMessageId(null)}
              />
            </div>
            <EmailNotesPanel
              messageId={selectedMessageId}
              noteKey={noteKey}
              aliasFilter={effectiveAliasFilter}
            />
          </>
          )
        })() : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select an email to read it</p>
          </div>
        )}
      </div>
    </div>
  )
}
