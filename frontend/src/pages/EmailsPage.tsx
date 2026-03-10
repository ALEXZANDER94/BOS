import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, Mail, MailOpen, AlertCircle, Inbox, Search, X,
  Settings2, Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useEmails, useEmailDetail, useRefreshEmails, useGmailStatus, useGmailAliases,
  type EmailFilter,
} from '@/hooks/useGmail'
import { useClients } from '@/hooks/useClients'
import {
  useEmailCategories, useEmailAssignmentsBatch, useCategoryEmails,
} from '@/hooks/useEmailCategories'
import { useUserPreference } from '@/hooks/useUserPreference'
import { CategoryManagementDialog } from '@/components/email/CategoryManagementDialog'
import { EmailAssignmentPanel } from '@/components/email/EmailAssignmentPanel'
import { EmailNotesPanel } from '@/components/email/EmailNotesPanel'
import { AddToBosButton } from '@/components/email/AddToBosButton'
import { emailNotesApi, type EmailNoteCounts } from '@/api/emailNotes'
import type { EmailSummary } from '@/api/gmail'
import type { EmailAssignment } from '@/api/emailCategories'
import type { Client } from '@/api/clients'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  email, isSelected, assignment, noteCount, onClick,
}: {
  email:       EmailSummary
  isSelected:  boolean
  assignment?: EmailAssignment
  noteCount?:  number
  onClick:     () => void
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
        <span className={cn('text-sm truncate', !email.isRead && 'font-semibold')}>
          {displayName(email)}
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
          <Badge
            className="text-[10px] h-4 px-1.5 border-none"
            style={{ backgroundColor: assignment.categoryColor, color: '#fff' }}
          >
            {assignment.categoryName}
            {assignment.statusName && ` · ${assignment.statusName}`}
          </Badge>
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
  clients,
}: {
  messageId: string
  clients:   Client[]
}) {
  const { data: detail, isLoading } = useEmailDetail(messageId)

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
            <EmailAssignmentPanel messageId={messageId} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-5 py-4">
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
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const [searchParams, setSearchParams]           = useSearchParams()
  const [filter, setFilter]                       = useState<EmailFilter>({ type: 'all' })
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [searchInput, setSearchInput]             = useState('')
  const [search, setSearch]                       = useState('')
  const [isEditingAliases, setIsEditingAliases]   = useState(false)

  // Deep-link from notification: /emails?select=messageId
  useEffect(() => {
    const sel = searchParams.get('select')
    if (sel) {
      setSelectedMessageId(sel)
      setSearchParams({}, { replace: true })
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
  const emails: EmailSummary[] = filter.type === 'category'
    ? (categoryData?.emails ?? [])
    : (gmailData?.pages.flatMap(p => p.emails) ?? [])

  const isLoading = filter.type === 'category' ? categoryLoading : gmailLoading

  // Batch-load assignments to decorate each row
  const messageIds = useMemo(() => emails.map(e => e.messageId), [emails])
  const { data: batchAssignments = [] } = useEmailAssignmentsBatch(messageIds)

  // Pre-build a messageId → assignment map for O(1) lookup
  const assignmentMap = useMemo(() =>
    Object.fromEntries(batchAssignments.map(a => [a.messageId, a])),
    [batchAssignments])

  // Fetch note counts for visible emails
  const noteCountIds = messageIds.join(',')
  const { data: noteCounts = {} } = useQuery<EmailNoteCounts>({
    queryKey: ['email-note-counts', noteCountIds],
    queryFn:  () => emailNotesApi.getNoteCounts(messageIds),
    enabled:  messageIds.length > 0,
  })

  // Category assignments already returned by useCategoryEmails
  const categoryAssignmentMap = useMemo(() => {
    if (filter.type !== 'category' || !categoryData) return {}
    return Object.fromEntries(categoryData.assignments.map(a => [a.messageId, a]))
  }, [filter, categoryData])

  const effectiveAssignmentMap = filter.type === 'category'
    ? categoryAssignmentMap
    : assignmentMap

  const lastFetched = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Aliases after hiding user-hidden ones
  const visibleAliases = aliases.filter(a => !hiddenAliases.includes(a))

  function selectFilter(f: EmailFilter) {
    setFilter(f)
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
          {filter.type !== 'category' && (
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
          )}
        </div>

        {/* Email rows */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No emails found.</p>
            </div>
          ) : (
            <>
              {emails.map(email => (
                <EmailRow
                  key={email.messageId}
                  email={email}
                  isSelected={selectedMessageId === email.messageId}
                  assignment={effectiveAssignmentMap[email.messageId]}
                  noteCount={noteCounts[email.messageId]}
                  onClick={() => setSelectedMessageId(email.messageId)}
                />
              ))}
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

        {/* Unread / total count */}
        {emails.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {emails.filter(e => !e.isRead).length} unread
            </span>
            <span className="flex items-center gap-1">
              <MailOpen className="h-3 w-3" />
              {emails.length} shown
            </span>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      <div className="flex-1 flex overflow-hidden">
        {selectedMessageId ? (
          <>
            <div className="flex-1 flex flex-col overflow-hidden">
              <EmailDetailPanel messageId={selectedMessageId} clients={clients} />
            </div>
            <EmailNotesPanel
              messageId={selectedMessageId}
              aliasFilter={filter.type === 'alias' ? filter.address : undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select an email to read it</p>
          </div>
        )}
      </div>
    </div>
  )
}
