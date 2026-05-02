import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, X, AlertTriangle, Paperclip, MessageSquare,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ticketApi, ticketCategoryApi, ticketStatusApi,
  type TicketSummary,
} from '@/api/tickets'
import { workspaceApi } from '@/api/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'

// ── Priority helpers ──────────────────────────────────────────────────────────

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  Medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  Low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none', PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.Low)}>
      {priority}
    </span>
  )
}

// ── Ticket row ────────────────────────────────────────────────────────────────

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const navigate = useNavigate()
  return (
    <tr
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border last:border-b-0"
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-xs text-muted-foreground">{ticket.ticketNumber}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: ticket.statusColor }}
          />
          <span className="text-sm font-medium truncate max-w-xs">{ticket.title}</span>
          {ticket.isOverdue && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
          )}
        </div>
        {ticket.categoryName && (
          <span
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
            style={{
              backgroundColor: ticket.categoryColor + '22',
              color: ticket.categoryColor ?? undefined,
            }}
          >
            {ticket.categoryName}
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <PriorityBadge priority={ticket.priority} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className="inline-block rounded px-2 py-0.5 text-[11px] font-medium leading-none"
          style={{
            backgroundColor: ticket.statusColor + '22',
            color: ticket.statusColor,
          }}
        >
          {ticket.statusName}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {ticket.assignedToEmail ?? <span className="italic">Unassigned</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {ticket.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {ticket.commentCount}
            </span>
          )}
          {ticket.attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> {ticket.attachmentCount}
            </span>
          )}
          {ticket.dueDate && (
            <span className={cn(ticket.isOverdue && 'text-red-500')}>
              Due {new Date(ticket.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [searchParams] = useSearchParams()

  const [search, setSearch]           = useState('')
  const [priority, setPriority]       = useState('')
  const [categoryId, setCategoryId]   = useState<number | undefined>()
  const [statusId, setStatusId]       = useState<number | undefined>()
  const [assignedTo, setAssignedTo]   = useState<string>('')
  const [showClosed, setShowClosed]   = useState(false)
  const [myTickets, setMyTickets]     = useState(searchParams.get('myTickets') === 'true')
  const [page, setPage]               = useState(1)
  const [createOpen, setCreateOpen]   = useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn:  ticketCategoryApi.getAll,
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn:  ticketStatusApi.getAll,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['workspace-users'],
    queryFn:  () => workspaceApi.getUsers(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', { search, priority, categoryId, statusId, assignedTo, showClosed, myTickets, page }],
    queryFn: () => ticketApi.list({
      search: search || undefined,
      priority: priority || undefined,
      categoryId,
      statusId,
      assignedTo: assignedTo || undefined,
      showClosed,
      myTickets,
      page,
      pageSize: 25,
    }),
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  function clearFilters() {
    setSearch('')
    setPriority('')
    setCategoryId(undefined)
    setStatusId(undefined)
    setAssignedTo('')
    setMyTickets(false)
    setPage(1)
  }

  const hasFilters = search || priority || categoryId || statusId || assignedTo || myTickets

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Tickets</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.total} tickets</p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-muted/20 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 w-56 text-sm"
            placeholder="Search tickets…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {/* Priority */}
        <Select value={priority || 'all'} onValueChange={v => { setPriority(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={categoryId?.toString() ?? 'all'}
          onValueChange={v => { setCategoryId(v === 'all' ? undefined : Number(v)); setPage(1) }}
        >
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={statusId?.toString() ?? 'all'}
          onValueChange={v => { setStatusId(v === 'all' ? undefined : Number(v)); setPage(1) }}
        >
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Assignee */}
        <Select
          value={assignedTo || 'all'}
          onValueChange={v => { setAssignedTo(v === 'all' ? '' : v); setPage(1) }}
        >
          <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {users.map(u => (
              <SelectItem key={u.email} value={u.email}>
                {u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* My tickets toggle */}
        <button
          onClick={() => { setMyTickets(v => !v); setPage(1) }}
          className={cn(
            'h-8 px-3 rounded-md border text-sm font-medium transition-colors',
            myTickets
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          My Tickets
        </button>

        {/* Closed toggle */}
        <button
          onClick={() => { setShowClosed(v => !v); setPage(1) }}
          className={cn(
            'h-8 px-3 rounded-md border text-sm font-medium transition-colors',
            showClosed
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          Show Closed
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-8 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Clear filters"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-muted-foreground">No tickets found</p>
            {!hasFilters && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Create first ticket
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">Priority</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Assigned</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Info</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(t => <TicketRow key={t.id} ticket={t} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-border shrink-0">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create dialog */}
      <CreateTicketDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        navigate={false}
      />
    </div>
  )
}
