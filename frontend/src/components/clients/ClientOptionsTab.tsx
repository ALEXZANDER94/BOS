import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X, Upload, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { clientAddonsApi, type ClientAddon, type ProjectAssignment } from '@/api/clientAddons'
import { projectApi, type Project } from '@/api/clients'
import ImportAddonsModal from './ImportAddonsModal'
import CustomUpgradesPanel from './CustomUpgradesPanel'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// ── Assignment sub-row ────────────────────────────────────────────────────────

function AssignmentRow({
  assignment, clientId, addonId, onRemoved,
}: {
  assignment: ProjectAssignment
  clientId:   number
  addonId:    number
  onRemoved:  () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [price,   setPrice]   = useState(assignment.price !== null ? String(assignment.price) : '')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['client-addons', clientId] })
  }

  const updateMut = useMutation({
    mutationFn: () => clientAddonsApi.upsertAssignment(
      clientId, addonId, assignment.projectId,
      price === '' ? null : parseFloat(price) || 0
    ),
    onSuccess: () => { setEditing(false); invalidate() },
    onError:   () => toast.error('Failed to update price.'),
  })

  const removeMut = useMutation({
    mutationFn: () => clientAddonsApi.removeAssignment(clientId, addonId, assignment.projectId),
    onSuccess:  () => { invalidate(); onRemoved() },
    onError:    () => toast.error('Failed to remove assignment.'),
  })

  if (editing) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell />
        <TableCell className="text-sm font-medium">{assignment.projectName}</TableCell>
        <TableCell>
          <Input
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            className="h-7 text-sm w-28"
            autoFocus
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending}
              className="p-1 rounded text-primary hover:bg-primary/10"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setEditing(false); setPrice(assignment.price !== null ? String(assignment.price) : '') }}
              className="p-1 rounded text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-muted/20">
      <TableCell />
      <TableCell className="text-sm font-medium">{assignment.projectName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{fmtAmount(assignment.price)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => removeMut.mutate()}
            disabled={removeMut.isPending}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Add assignment inline row ─────────────────────────────────────────────────

function AddAssignmentRow({
  clientId, addonId, projects, assignedProjectIds,
}: {
  clientId:           number
  addonId:            number
  projects:           Project[]
  assignedProjectIds: Set<number>
}) {
  const qc = useQueryClient()
  const [open,      setOpen]      = useState(false)
  const [projectId, setProjectId] = useState<string>('')
  const [price,     setPrice]     = useState('')

  const unassigned = projects.filter(p => !assignedProjectIds.has(p.id))

  const createMut = useMutation({
    mutationFn: () => clientAddonsApi.upsertAssignment(
      clientId, addonId, Number(projectId),
      price === '' ? null : parseFloat(price) || 0
    ),
    onSuccess: () => {
      setProjectId('')
      setPrice('')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['client-addons', clientId] })
    },
    onError: () => toast.error('Failed to assign project.'),
  })

  if (!open) {
    return (
      <TableRow className="bg-muted/10">
        <TableCell />
        <TableCell colSpan={3}>
          <button
            onClick={() => setOpen(true)}
            disabled={unassigned.length === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
            {unassigned.length === 0 ? 'All projects assigned' : 'Assign project'}
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell />
      <TableCell>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-7 text-sm w-44">
            <SelectValue placeholder="Select project…" />
          </SelectTrigger>
          <SelectContent>
            {unassigned.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          className="h-7 text-sm w-28"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            onClick={() => createMut.mutate()}
            disabled={!projectId || createMut.isPending}
            className="p-1 rounded text-primary hover:bg-primary/10"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setOpen(false); setProjectId(''); setPrice('') }}
            className="p-1 rounded text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Addon row ─────────────────────────────────────────────────────────────────

interface AddonFormState { code: string; description: string; notes: string }
function emptyForm(): AddonFormState { return { code: '', description: '', notes: '' } }

function AddonRow({
  addon, clientId, projects, expanded, onToggle,
}: {
  addon:    ClientAddon
  clientId: number
  projects: Project[]
  expanded: boolean
  onToggle: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState<AddonFormState>(emptyForm())

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['client-addons', clientId] })
  }

  const updateMut = useMutation({
    mutationFn: () => clientAddonsApi.update(clientId, addon.id, form),
    onSuccess:  () => { setEditing(false); invalidate() },
    onError:    (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update option.')
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => clientAddonsApi.delete(clientId, addon.id),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to delete option.'),
  })

  const assignedProjectIds = new Set(addon.assignments.map(a => a.projectId))
  const ChevronIcon = expanded ? ChevronDown : ChevronRight

  return (
    <>
      {editing ? (
        <TableRow>
          <TableCell>
            <button onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronIcon className="h-4 w-4" />
            </button>
          </TableCell>
          <TableCell>
            <Input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="h-7 text-sm w-28"
              autoFocus
            />
          </TableCell>
          <TableCell colSpan={2}>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="h-7 text-sm"
              placeholder="Description"
            />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateMut.mutate()}
                disabled={!form.code.trim() || updateMut.isPending}
                className="p-1 rounded text-primary hover:bg-primary/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1 rounded text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </TableCell>
        </TableRow>
      ) : (
        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
          <TableCell>
            <ChevronIcon className="h-4 w-4 text-muted-foreground" />
          </TableCell>
          <TableCell className="font-mono text-sm font-medium">{addon.code}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{addon.description}</TableCell>
          <TableCell>
            <Badge variant="secondary" className="text-[10px]">
              {addon.assignments.length} {addon.assignments.length === 1 ? 'project' : 'projects'}
            </Badge>
          </TableCell>
          <TableCell onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setForm({ code: addon.code, description: addon.description, notes: addon.notes }); setEditing(true) }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </TableCell>
        </TableRow>
      )}

      {expanded && addon.notes && (
        <TableRow className="bg-muted/10">
          <TableCell />
          <TableCell colSpan={4} className="text-xs text-muted-foreground italic py-1.5">
            {addon.notes}
          </TableCell>
        </TableRow>
      )}

      {expanded && (
        <>
          {addon.assignments.length > 0 && (
            <TableRow className="bg-muted/10">
              <TableCell />
              <TableCell className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">Project</TableCell>
              <TableCell className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">Price</TableCell>
              <TableCell />
            </TableRow>
          )}
          {addon.assignments.map(a => (
            <AssignmentRow
              key={a.projectId}
              assignment={a}
              clientId={clientId}
              addonId={addon.id}
              onRemoved={() => {}}
            />
          ))}
          <AddAssignmentRow
            clientId={clientId}
            addonId={addon.id}
            projects={projects}
            assignedProjectIds={assignedProjectIds}
          />
        </>
      )}
    </>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ClientOptionsTab({ clientId }: { clientId: number }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [addingNew,   setAddingNew]   = useState(false)
  const [importOpen,  setImportOpen]  = useState(false)
  const [newForm,     setNewForm]     = useState<AddonFormState>(emptyForm())
  const [search,      setSearch]      = useState('')

  const qc = useQueryClient()

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ['client-addons', clientId],
    queryFn:  () => clientAddonsApi.getAll(clientId),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', clientId],
    queryFn:  () => projectApi.getAll(clientId),
  })

  const createMut = useMutation({
    mutationFn: () => clientAddonsApi.create(clientId, newForm),
    onSuccess: () => {
      setNewForm(emptyForm())
      setAddingNew(false)
      qc.invalidateQueries({ queryKey: ['client-addons', clientId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create option.')
    },
  })

  const term = search.trim().toLowerCase()

  const filteredAddons = useMemo(() => {
    if (!term) return addons
    return addons.filter(a =>
      a.code.toLowerCase().includes(term)        ||
      a.description.toLowerCase().includes(term) ||
      a.notes.toLowerCase().includes(term)       ||
      a.assignments.some(x => x.projectName.toLowerCase().includes(term))
    )
  }, [addons, term])

  const autoExpandedIds = useMemo(() => {
    if (!term) return null
    return new Set(
      filteredAddons
        .filter(a =>
          !a.code.toLowerCase().includes(term) &&
          !a.description.toLowerCase().includes(term) &&
          !a.notes.toLowerCase().includes(term) &&
          a.assignments.some(x => x.projectName.toLowerCase().includes(term))
        )
        .map(a => a.id)
    )
  }, [filteredAddons, term])

  function isExpanded(id: number) {
    return autoExpandedIds?.has(id) || expandedIds.has(id)
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search options or projects…"
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Option
          </Button>
        </div>
      </div>

      {/* Add new form */}
      {addingNew && (
        <div className="rounded-md border p-4 space-y-3">
          <p className="text-sm font-medium">New Option</p>
          <div className="flex gap-3 flex-wrap">
            <div className="w-32">
              <Input
                value={newForm.code}
                onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Code"
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex-1 min-w-48">
              <Input
                value={newForm.description}
                onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Textarea
            value={newForm.notes}
            onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!newForm.code.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAddingNew(false); setNewForm(emptyForm()) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : addons.length === 0 && !addingNew ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No options yet.</p>
          <p className="text-xs text-muted-foreground">Add an option or import from CSV.</p>
        </div>
      ) : filteredAddons.length === 0 && term ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No options match "{search}".</p>
        </div>
      ) : filteredAddons.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28">Projects</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAddons.map(addon => (
                <AddonRow
                  key={addon.id}
                  addon={addon}
                  clientId={clientId}
                  projects={projects}
                  expanded={isExpanded(addon.id)}
                  onToggle={() => toggleExpand(addon.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {importOpen && (
        <ImportAddonsModal clientId={clientId} projects={projects} onClose={() => setImportOpen(false)} />
      )}

      <div className="pt-6 border-t">
        <CustomUpgradesPanel clientId={clientId} />
      </div>
    </div>
  )
}
