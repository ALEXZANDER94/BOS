import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAllProposals } from '@/hooks/useProposals'
import { useClients } from '@/hooks/useClients'
import type { ProposalStatus, ProposalType } from '@/api/proposals'

const STATUS_COLORS: Record<string, string> = {
  Draft:     'bg-gray-100  text-gray-800  border-gray-300  dark:bg-gray-950/40  dark:text-gray-400',
  Sent:      'bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-950/40  dark:text-blue-400',
  Accepted:  'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Converted: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400',
  Rejected:  'bg-red-100   text-red-800   border-red-300   dark:bg-red-950/40   dark:text-red-400',
}

const TYPE_LABELS: Record<ProposalType, string> = {
  SingleFamily: 'Single Family',
  MultiFamily:  'Multi Family',
}

// Backend stamps every DateTime as Kind=Utc on read (AppDbContext.cs), so deadlines
// arrive here as UTC midnight ("2026-05-01T00:00:00Z"). Formatting with the default
// (local) timezone shifts that back a day in any timezone west of UTC, so we force
// UTC to keep the calendar date the user picked.
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// For "is this overdue / due soon" we compare the UTC calendar date the user picked
// against today's UTC calendar date — same reason as fmtDate above.
function deadlineClass(iso: string | null) {
  if (!iso) return ''
  const deadlineDay = new Date(iso)
  const deadlineUtc = Date.UTC(
    deadlineDay.getUTCFullYear(),
    deadlineDay.getUTCMonth(),
    deadlineDay.getUTCDate(),
  )
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const days = (deadlineUtc - todayUtc) / 86_400_000
  if (days < 0)  return 'text-red-600 font-medium'
  if (days <= 2) return 'text-amber-600 font-medium'
  return ''
}

const STATUS_FILTER_STORAGE_KEY = 'bos.proposals.statusFilter'

function loadStoredStatus(): ProposalStatus | '' {
  if (typeof window === 'undefined') return 'Draft'
  const raw = window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY)
  if (raw === null) return 'Draft'
  if (raw === '' || raw === 'Draft' || raw === 'Sent' || raw === 'Accepted'
      || raw === 'Rejected' || raw === 'Converted') {
    return raw
  }
  return 'Draft'
}

export default function ProposalsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | ''>(loadStoredStatus)
  const [typeFilter, setTypeFilter] = useState<ProposalType | ''>('')
  const [clientFilter, setClientFilter] = useState<number | undefined>()
  const [includeConverted, setIncludeConverted] = useState(false)

  // Persist the status filter so the user's preferred view (default: Draft) survives
  // navigating away and back to this page.
  useEffect(() => {
    window.localStorage.setItem(STATUS_FILTER_STORAGE_KEY, statusFilter)
  }, [statusFilter])

  const { data: proposals = [], isLoading } = useAllProposals(
    search       || undefined,
    statusFilter || undefined,
    typeFilter   || undefined,
    clientFilter,
    includeConverted,
  )

  const { data: clients = [] } = useClients()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Proposals</h2>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : `${proposals.length} ${proposals.length === 1 ? 'proposal' : 'proposals'}${search ? ` matching "${search}"` : ''}`}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search proposals…"
            className="pl-8"
          />
        </div>

        <Select
          value={statusFilter || 'all'}
          onValueChange={v => setStatusFilter(v === 'all' ? '' : v as ProposalStatus)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Accepted">Accepted</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            {includeConverted && <SelectItem value="Converted">Converted</SelectItem>}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter || 'all'}
          onValueChange={v => setTypeFilter(v === 'all' ? '' : v as ProposalType)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="SingleFamily">Single Family</SelectItem>
            <SelectItem value="MultiFamily">Multi Family</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={clientFilter ? String(clientFilter) : 'all'}
          onValueChange={v => setClientFilter(v === 'all' ? undefined : Number(v))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={includeConverted}
            onCheckedChange={v => setIncludeConverted(!!v)}
          />
          Show converted
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading proposals…</p>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No proposals found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      to={`/clients/${p.clientId}/proposals/${p.id}`}
                      className="font-medium hover:underline text-foreground"
                    >
                      {p.name || <span className="italic text-muted-foreground">Untitled</span>}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/clients/${p.clientId}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {p.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TYPE_LABELS[p.type] ?? p.type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[p.status] ?? ''}`}
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-sm whitespace-nowrap ${deadlineClass(p.deadline) || 'text-muted-foreground'}`}>
                    {fmtDate(p.deadline)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(p.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
