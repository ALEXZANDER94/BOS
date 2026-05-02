import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'sonner'
import {
  TicketCheck, AlertTriangle, UserCheck, CheckCircle2,
  FolderKanban, Building2, MapPin, ShoppingCart, DollarSign,
  Megaphone, Pencil, Check, X,
} from 'lucide-react'
import { dashboardApi, type TicketSummary } from '@/api/tickets'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, onClick,
}: {
  label:    string
  value:    number | string
  icon:     React.ElementType
  color:    string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors',
        onClick ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default',
      )}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </button>
  )
}

// ── Priority badge ────────────────────────────────────────────────────────────

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
    <button
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: ticket.statusColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">
          <span className="text-muted-foreground text-xs mr-1.5">{ticket.ticketNumber}</span>
          {ticket.title}
        </p>
        {ticket.assignedToEmail && (
          <p className="text-[11px] text-muted-foreground truncate">{ticket.assignedToEmail}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {ticket.isOverdue && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        )}
        <PriorityBadge priority={ticket.priority} />
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Admin notice banner ──────────────────────────────────────────────────────

interface AuthMe { name: string; email: string; isAdmin: boolean }
interface AdminNotice { message: string }

function AdminNoticeBanner() {
  const qc = useQueryClient()

  const { data: me } = useQuery<AuthMe>({
    queryKey: ['me'],
    queryFn:  () => axios.get<AuthMe>('/api/auth/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: notice } = useQuery<AdminNotice>({
    queryKey: ['admin-notice'],
    queryFn:  () => axios.get<AdminNotice>('/api/admin/notice').then(r => r.data),
  })

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  // Sync draft when entering edit mode or when notice changes
  useEffect(() => {
    if (notice) setDraft(notice.message)
  }, [notice])

  const saveMut = useMutation({
    mutationFn: (message: string) =>
      axios.put<AdminNotice>('/api/admin/notice', { message }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notice'] })
      setEditing(false)
      toast.success('Notice updated')
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) toast.error('Only admins can update the notice.')
      else toast.error('Failed to update notice.')
    },
  })

  const message = notice?.message ?? ''
  const isAdmin = me?.isAdmin ?? false

  // Hide entirely when there's no notice and the user isn't an admin.
  if (!editing && !message && !isAdmin) return null

  return (
    <div className="w-full border-b border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
      <div className="px-6 py-3 flex items-start gap-3">
        <Megaphone className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Enter the admin notice (leave blank to clear)…"
              className="text-sm bg-background/60"
              rows={2}
              autoFocus
            />
          ) : message ? (
            <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap break-words">
              {message}
            </p>
          ) : (
            <p className="text-sm italic text-amber-900/70 dark:text-amber-200/70">
              No admin notice set. Click edit to publish one.
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  onClick={() => saveMut.mutate(draft)}
                  disabled={saveMut.isPending}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  onClick={() => { setEditing(false); setDraft(message) }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  dashboardApi.get,
  })

  if (isLoading || !data) {
    return (
      <div className="flex h-full flex-col">
        <AdminNoticeBanner />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  const { ticketStats, recentTickets, myOpenTickets,
          activeProjectCount, buildingCount, lotCount,
          totalPurchaseOrders, totalPoAmount } = data

  const formatCurrency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <div className="flex flex-col w-full">
      <AdminNoticeBanner />
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of all active operations</p>
      </div>

      {/* ── Ticket stats ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tickets</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Open"
            value={ticketStats.openCount}
            icon={TicketCheck}
            color="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            onClick={() => navigate('/tickets')}
          />
          <StatCard
            label="Overdue"
            value={ticketStats.overdueCount}
            icon={AlertTriangle}
            color="bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            onClick={() => navigate('/tickets')}
          />
          <StatCard
            label="Assigned to Me"
            value={ticketStats.assignedToMeCount}
            icon={UserCheck}
            color="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
            onClick={() => navigate('/tickets?myTickets=true')}
          />
          <StatCard
            label="Closed This Month"
            value={ticketStats.closedThisMonthCount}
            icon={CheckCircle2}
            color="bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
          />
        </div>
      </section>

      {/* ── Project stats ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projects</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Active Projects"
            value={activeProjectCount}
            icon={FolderKanban}
            color="bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
            onClick={() => navigate('/projects')}
          />
          <StatCard
            label="Buildings"
            value={buildingCount}
            icon={Building2}
            color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          />
          <StatCard
            label="Lots"
            value={lotCount}
            icon={MapPin}
            color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          />
          <StatCard
            label="Total POs"
            value={totalPurchaseOrders}
            icon={ShoppingCart}
            color="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>
        {totalPoAmount > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Total PO value: <strong className="text-foreground">{formatCurrency(totalPoAmount)}</strong></span>
          </div>
        )}
      </section>

      {/* ── Two-column ticket lists ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent open tickets */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Recently Updated Tickets</h2>
            <button
              onClick={() => navigate('/tickets')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {recentTickets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No open tickets</p>
          ) : (
            recentTickets.map(t => <TicketRow key={t.id} ticket={t} />)
          )}
        </section>

        {/* My open tickets */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">My Open Tickets</h2>
            <button
              onClick={() => navigate('/tickets?myTickets=true')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {myOpenTickets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No tickets assigned to you</p>
          ) : (
            myOpenTickets.map(t => <TicketRow key={t.id} ticket={t} />)
          )}
        </section>
      </div>
      </div>
    </div>
  )
}
