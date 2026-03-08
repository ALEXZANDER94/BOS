import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, Mail, MailOpen, AlertCircle, Inbox, Search, X } from 'lucide-react'
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
import { CategoryManagementDialog } from '@/components/email/CategoryManagementDialog'
import { EmailAssignmentPanel } from '@/components/email/EmailAssignmentPanel'
import type { EmailSummary } from '@/api/gmail'
import type { EmailAssignment } from '@/api/emailCategories'

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

function filterLabel(filter: EmailFilter, clients: { id: number; name: string }[], categories: { id: number; name: string }[]) {
  if (filter.type === 'all')      return 'All Emails'
  if (filter.type === 'client')   return clients.find(c => c.id === filter.id)?.name ?? 'Emails'
  if (filter.type === 'alias')    return filter.address
  if (filter.type === 'category') return categories.find(c => c.id === filter.id)?.name ?? 'Category'
  return 'All Emails'
}

// ── Sidebar button ────────────────────────────────────────────────────────────

function SidebarBtn({
  active, onClick, children, dot,
}: {
  active:    boolean
  onClick:   () => void
  children:  React.ReactNode
  dot?:      string
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
      {dot && (
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      <span className="truncate">{children}</span>
    </button>
  )
}

// ── Email list item ───────────────────────────────────────────────────────────

function EmailRow({
  email,
  isSelected,
  assignment,
  onClick,
}: {
  email:      EmailSummary
  isSelected: boolean
  assignment?: EmailAssignment
  onClick:    () => void
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
      </div>
    </button>
  )
}

// ── Email detail panel ────────────────────────────────────────────────────────

function EmailDetailPanel({ messageId }: { messageId: string }) {
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
          <p>
            <span className="font-medium text-foreground">From:</span>{' '}
            {detail.fromName ? `${detail.fromName} <${detail.fromAddress}>` : detail.fromAddress}
          </p>
          <p>
            <span className="font-medium text-foreground">To:</span>{' '}
            {detail.toAddresses}
          </p>
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
              <span className="font-medium text-foreground">Client:</span>{' '}
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
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
  const [filter, setFilter]               = useState<EmailFilter>({ type: 'all' })
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [searchInput, setSearchInput]     = useState('')
  const [search, setSearch]               = useState('')

  // Debounce search input 300 ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: status }                   = useGmailStatus()
  const { data: aliases = [] }             = useGmailAliases()
  const { data: clients = [] }             = useClients()
  const { data: categories = [] }          = useEmailCategories()

  // Standard Gmail email fetch (all / client / alias filters)
  const { data: gmailData, isLoading: gmailLoading, dataUpdatedAt } =
    useEmails(filter, search || undefined)

  // Category-filtered email fetch (assignments DB → Gmail by IDs)
  const { data: categoryData, isLoading: categoryLoading } =
    useCategoryEmails(filter.type === 'category' ? filter.id : null)

  const refresh = useRefreshEmails(filter, search || undefined)

  // Unified email list depending on active filter
  const emails: EmailSummary[] = filter.type === 'category'
    ? (categoryData?.emails ?? [])
    : (gmailData?.emails ?? [])

  const isLoading = filter.type === 'category' ? categoryLoading : gmailLoading

  // Batch-load assignments to decorate each row
  const messageIds = useMemo(() => emails.map(e => e.messageId), [emails])
  const { data: batchAssignments = [] } = useEmailAssignmentsBatch(messageIds)

  // Pre-build a messageId → assignment map for O(1) lookup
  const assignmentMap = useMemo(() =>
    Object.fromEntries(batchAssignments.map(a => [a.messageId, a])),
    [batchAssignments])

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

  function selectFilter(f: EmailFilter) {
    setFilter(f)
    setSelectedMessageId(null)
    setSearchInput('')
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

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">

        {/* Inboxes */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inboxes
          </p>
        </div>
        <nav className="p-2 space-y-0.5 border-b border-border">
          <SidebarBtn
            active={filter.type === 'all'}
            onClick={() => selectFilter({ type: 'all' })}
          >
            All Emails
          </SidebarBtn>
          {aliases.map(address => (
            <SidebarBtn
              key={address}
              active={filter.type === 'alias' && filter.address === address}
              onClick={() => selectFilter({ type: 'alias', address })}
            >
              {address}
            </SidebarBtn>
          ))}
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
            emails.map(email => (
              <EmailRow
                key={email.messageId}
                email={email}
                isSelected={selectedMessageId === email.messageId}
                assignment={effectiveAssignmentMap[email.messageId]}
                onClick={() => setSelectedMessageId(email.messageId)}
              />
            ))
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
      <div className="flex-1 overflow-hidden">
        {selectedMessageId ? (
          <EmailDetailPanel messageId={selectedMessageId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select an email to read it</p>
          </div>
        )}
      </div>
    </div>
  )
}
