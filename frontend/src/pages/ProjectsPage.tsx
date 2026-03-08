import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { useAllProjects } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active:    'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Completed: 'bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-950/40  dark:text-blue-400',
  'On Hold': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Cancelled: 'bg-red-100   text-red-800   border-red-300   dark:bg-red-950/40   dark:text-red-400',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = '' | 'Active' | 'Completed' | 'On Hold' | 'Cancelled'

export default function ProjectsPage() {
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [clientFilter, setClientFilter] = useState<number | undefined>(undefined)

  const { data: projects = [], isLoading } = useAllProjects(
    search   || undefined,
    statusFilter || undefined,
    clientFilter
  )

  const { data: clients = [] } = useClients()

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}${search ? ` matching "${search}"` : ''}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="pl-8"
          />
        </div>

        <Select
          value={statusFilter || 'all'}
          onValueChange={v => setStatusFilter(v === 'all' ? '' : v as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="On Hold">On Hold</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
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
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No projects found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(project => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{project.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_COLORS[project.status] ?? ''}`}
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/clients/${project.clientId}`}
                      className="text-sm text-blue-600 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {project.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {project.description || <span className="italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(project.startDate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(project.endDate)}
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
