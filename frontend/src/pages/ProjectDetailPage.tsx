import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, ChevronDown, ChevronRight,
  MapPin, Pencil, Plus, RefreshCw, Trash2, X, Check,
  CheckCircle2, AlertCircle, Upload, Settings2,
  ChevronsUpDown, Download, ArrowUp, ArrowDown, ArrowUpDown, TicketCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  projectDetailApi,
  buildingApi,
  lotApi,
  planApi,
  purchaseOrderApi,
  purchaseOrderStatusApi,
  quickBooksApi,
  type Building,
  type Lot,
  type Plan,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type UpsertAddressRequest,
  type UpdateProjectRequest,
} from '@/api/projects'
import ImportPoModal from '@/components/projects/ImportPoModal'
import ManagePoStatusesDialog from '@/components/projects/ManagePoStatusesDialog'
import ProjectOptionsPanel from '@/components/projects/ProjectOptionsPanel'
import FixturesPanel from '@/components/projects/FixturesPanel'
import ImportBuildingsModal from '@/components/projects/ImportBuildingsModal'
import EstimatesTab from '@/components/projects/EstimatesTab'
import { fixtureApi } from '@/api/fixtures'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active:    'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Completed: 'bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-950/40  dark:text-blue-400',
  'On Hold': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Cancelled: 'bg-red-100   text-red-800   border-red-300   dark:bg-red-950/40   dark:text-red-400',
}

const QB_STATUS_COLORS: Record<string, string> = {
  Unpaid:      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Paid:        'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  'Not Found': 'bg-muted text-muted-foreground border-border',
}

const QB_STATUSES = ['Unpaid', 'Paid', 'Not Found'] as const

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

type Tab = 'overview' | 'buildings' | 'estimates' | 'pos' | 'fixtures' | 'options'

// ── Edit Project dialog ───────────────────────────────────────────────────────

const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'] as const

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10) // 'YYYY-MM-DD'
}

function EditProjectDialog({
  project,
  onClose,
  onSaved,
}: {
  project:  { id: number; clientId: number; name: string; description: string; status: string; startDate: string | null; endDate: string | null }
  onClose:  () => void
  onSaved:  () => void
}) {
  const [form, setForm] = useState<UpdateProjectRequest>({
    name:        project.name,
    description: project.description,
    status:      project.status,
    startDate:   project.startDate ?? null,
    endDate:     project.endDate   ?? null,
  })

  const set = <K extends keyof UpdateProjectRequest>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value || null }))

  const setStr = (k: 'name' | 'description' | 'status') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const updateMut = useMutation({
    mutationFn: () => projectDetailApi.update(project.clientId, project.id, form),
    onSuccess:  () => { onSaved(); onClose() },
    onError:    () => toast.error('Failed to update project.'),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={setStr('name')} placeholder="Project name" />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={setStr('description')}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={setStr('status')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PROJECT_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={toDateInput(form.startDate)}
                onChange={set('startDate')}
              />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={toDateInput(form.endDate)}
                onChange={set('endDate')}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMut.mutate()}
            disabled={!form.name.trim() || updateMut.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Address form ──────────────────────────────────────────────────────────────

const EMPTY_ADDR: UpsertAddressRequest = { address1: '', address2: '', city: '', state: '', zip: '', country: '' }

function AddressForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: UpsertAddressRequest
  onSave:  (data: UpsertAddressRequest) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof UpsertAddressRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-2 mt-1 p-3 rounded-md border border-border bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Address Line 1</Label>
          <Input value={form.address1} onChange={set('address1')} placeholder="123 Main St" className="h-7 text-sm mt-0.5" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Address Line 2</Label>
          <Input value={form.address2} onChange={set('address2')} placeholder="Suite 100" className="h-7 text-sm mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={set('city')} placeholder="Springfield" className="h-7 text-sm mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">State</Label>
          <Input value={form.state} onChange={set('state')} placeholder="IL" className="h-7 text-sm mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Zip</Label>
          <Input value={form.zip} onChange={set('zip')} placeholder="62701" className="h-7 text-sm mt-0.5" />
        </div>
        <div>
          <Label className="text-xs">Country</Label>
          <Input value={form.country} onChange={set('country')} placeholder="US" className="h-7 text-sm mt-0.5" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onSave(form)} disabled={isSaving}>
          <Check className="h-3 w-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Lot row ───────────────────────────────────────────────────────────────────

function LotRow({
  lot,
  plans,
  onChanged,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  lot:        Lot
  plans:      Plan[]
  onChanged:  () => void
  onMoveUp:   () => void
  onMoveDown: () => void
  isFirst:    boolean
  isLast:     boolean
}) {
  const [editingName, setEditingName] = useState(false)
  const [editingAddr, setEditingAddr] = useState(false)
  const [name, setName]               = useState(lot.name)
  const [desc, setDesc]               = useState(lot.description)

  const updateMut = useMutation({
    mutationFn: () => lotApi.update(lot.buildingId, lot.id, {
      name: name.trim(), description: desc.trim(), planId: lot.planId,
    }),
    onSuccess:  () => { setEditingName(false); onChanged() },
    onError:    () => toast.error('Failed to update lot.'),
  })

  const planMut = useMutation({
    mutationFn: (planId: number | null) => lotApi.update(lot.buildingId, lot.id, {
      name: lot.name, description: lot.description, planId,
    }),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to assign plan.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => lotApi.delete(lot.buildingId, lot.id),
    onSuccess:  onChanged,
    onError:    (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete lot.')
    },
  })

  const addrMut = useMutation({
    mutationFn: (data: UpsertAddressRequest) => lotApi.upsertAddress(lot.buildingId, lot.id, data),
    onSuccess:  () => { setEditingAddr(false); onChanged() },
    onError:    () => toast.error('Failed to save address.'),
  })

  const delAddrMut = useMutation({
    mutationFn: () => lotApi.deleteAddress(lot.buildingId, lot.id),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to remove address.'),
  })

  const addr = lot.address
  const addrLine = addr
    ? [addr.address1, addr.address2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
    : null

  return (
    <div className="ml-6 border-l border-border pl-4 py-1">
      {editingName ? (
        <div className="flex items-center gap-2">
          <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm w-48" />
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" className="h-7 text-sm w-48" />
          <button onClick={() => updateMut.mutate()} className="p-1 rounded text-primary hover:bg-primary/10" title="Save">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditingName(false)} className="p-1 rounded text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{lot.name}</span>
          {lot.description && (
            <span className="text-xs text-muted-foreground">— {lot.description}</span>
          )}
          {plans.length > 0 && (
            <select
              value={lot.planId ?? ''}
              onChange={e => planMut.mutate(e.target.value ? Number(e.target.value) : null)}
              disabled={planMut.isPending}
              className="text-[10px] h-5 rounded border border-border bg-background px-1"
              title="Plan"
            >
              <option value="">— No plan —</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.planName}
                </option>
              ))}
            </select>
          )}
          {!isFirst && (
            <button onClick={onMoveUp} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Move up">
              <ArrowUp className="h-3 w-3" />
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Move down">
              <ArrowDown className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => { setName(lot.name); setDesc(lot.description); setEditingName(true) }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Edit lot"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
            title="Delete lot"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Address */}
      <div className="mt-0.5">
        {addrLine ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{addrLine}</span>
            <button
              onClick={() => setEditingAddr(v => !v)}
              className="ml-1 px-1.5 py-0.5 rounded text-xs border border-border hover:bg-muted"
            >
              Edit
            </button>
            <button
              onClick={() => delAddrMut.mutate()}
              disabled={delAddrMut.isPending}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
              title="Remove address"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingAddr(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add address
          </button>
        )}

        {editingAddr && (
          <AddressForm
            initial={addr
              ? { address1: addr.address1, address2: addr.address2, city: addr.city, state: addr.state, zip: addr.zip, country: addr.country }
              : EMPTY_ADDR}
            onSave={data => addrMut.mutate(data)}
            onCancel={() => setEditingAddr(false)}
            isSaving={addrMut.isPending}
          />
        )}
      </div>
    </div>
  )
}

// ── Building card ─────────────────────────────────────────────────────────────

function BuildingCard({
  building,
  projectId,
  expanded,
  onToggle,
  onChanged,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  building:   Building
  projectId:  number
  expanded:   boolean
  onToggle:   () => void
  onChanged:  () => void
  onMoveUp:   () => void
  onMoveDown: () => void
  isFirst:    boolean
  isLast:     boolean
}) {
  const [editingName,  setEditingName]  = useState(false)
  const [addingLot,    setAddingLot]    = useState(false)
  const [name,         setName]         = useState(building.name)
  const [desc,         setDesc]         = useState(building.description)
  const [newLotName,   setNewLotName]   = useState('')
  const [newLotDesc,   setNewLotDesc]   = useState('')

  const updateMut = useMutation({
    mutationFn: () => buildingApi.update(projectId, building.id, { name: name.trim(), description: desc.trim() }),
    onSuccess:  () => { setEditingName(false); onChanged() },
    onError:    () => toast.error('Failed to update building.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => buildingApi.delete(projectId, building.id),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to delete building.'),
  })

  const reorderLotMut = useMutation({
    mutationFn: (orderedIds: number[]) => lotApi.reorder(building.id, orderedIds),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to reorder lots.'),
  })

  function moveLot(index: number, dir: -1 | 1) {
    const ids = building.lots.map(l => l.id)
    const target = index + dir
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderLotMut.mutate(ids)
  }

  const addLotMut = useMutation({
    mutationFn: () => lotApi.create(building.id, {
      name: newLotName.trim(), description: newLotDesc.trim(), planId: null,
    }),
    onSuccess:  () => { setAddingLot(false); setNewLotName(''); setNewLotDesc(''); onChanged() },
    onError:    () => toast.error('Failed to add lot.'),
  })

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      {/* Building header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <button
          onClick={onToggle}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />

        {editingName ? (
          <>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm w-48" />
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" className="h-7 text-sm w-48" />
            <button onClick={() => updateMut.mutate()} className="p-1 rounded text-primary hover:bg-primary/10">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditingName(false)} className="p-1 rounded text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="font-medium text-sm">{building.name}</span>
            {building.description && (
              <span className="text-xs text-muted-foreground">— {building.description}</span>
            )}
            <span className="ml-1 text-xs text-muted-foreground">
              {building.lots.length} lot{building.lots.length !== 1 ? 's' : ''}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {!isFirst && (
                <button onClick={onMoveUp} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Move up">
                  <ArrowUp className="h-3 w-3" />
                </button>
              )}
              {!isLast && (
                <button onClick={onMoveDown} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Move down">
                  <ArrowDown className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => { setName(building.name); setDesc(building.description); setEditingName(true) }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Edit building"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                title="Delete building"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Lots + Fixtures */}
      {expanded && (
        <div className="px-3 py-2 space-y-1">
          {building.lots.length === 0 && !addingLot && (
            <p className="text-xs text-muted-foreground py-1">No lots yet.</p>
          )}

          {building.lots.map((lot, i) => (
            <LotRow
              key={lot.id}
              lot={lot}
              plans={building.plans}
              onChanged={onChanged}
              onMoveUp={() => moveLot(i, -1)}
              onMoveDown={() => moveLot(i, 1)}
              isFirst={i === 0}
              isLast={i === building.lots.length - 1}
            />
          ))}

          {addingLot ? (
            <div className="ml-6 pl-4 border-l border-border flex items-center gap-2 pt-1">
              <Input
                value={newLotName}
                onChange={e => setNewLotName(e.target.value)}
                placeholder="Lot name"
                className="h-7 text-sm w-40"
                autoFocus
              />
              <Input
                value={newLotDesc}
                onChange={e => setNewLotDesc(e.target.value)}
                placeholder="Description"
                className="h-7 text-sm w-40"
              />
              <button
                onClick={() => addLotMut.mutate()}
                disabled={!newLotName.trim() || addLotMut.isPending}
                className="p-1 rounded text-primary hover:bg-primary/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setAddingLot(false); setNewLotName('') }} className="p-1 rounded text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                const nums = building.lots.map(l => parseInt(l.name)).filter(n => !isNaN(n))
                setNewLotName(String((nums.length ? Math.max(...nums) : building.lots.length) + 1))
                setAddingLot(true)
              }}
              className="ml-6 pl-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" /> Add lot
            </button>
          )}

          <BuildingPlansSection building={building} onChanged={onChanged} />

          <FixturesPanel buildingId={building.id} />
        </div>
      )}
    </div>
  )
}

// ── Building Plans (project-side) ─────────────────────────────────────────────

function BuildingPlansSection({
  building,
  onChanged,
}: {
  building:  Building
  onChanged: () => void
}) {
  const [adding,    setAdding]    = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name,      setName]      = useState('')
  const [sqft,      setSqft]      = useState('')
  const [amount,    setAmount]    = useState('')

  function reset() {
    setAdding(false)
    setEditingId(null)
    setName('')
    setSqft('')
    setAmount('')
  }

  const createMut = useMutation({
    mutationFn: () => planApi.create(building.id, {
      planName: name.trim(),
      squareFootage: Number(sqft) || 0,
      amount: Number(amount) || 0,
    }),
    onSuccess: () => { reset(); onChanged() },
    onError:   () => toast.error('Failed to add plan.'),
  })

  const updateMut = useMutation({
    mutationFn: (id: number) => planApi.update(building.id, id, {
      planName: name.trim(),
      squareFootage: Number(sqft) || 0,
      amount: Number(amount) || 0,
    }),
    onSuccess: () => { reset(); onChanged() },
    onError:   () => toast.error('Failed to update plan.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => planApi.delete(building.id, id),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to delete plan.'),
  })

  function startEdit(p: Plan) {
    setEditingId(p.id)
    setName(p.planName)
    setSqft(String(p.squareFootage))
    setAmount(String(p.amount))
  }

  return (
    <div className="mt-3 pt-2 border-t border-dashed border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Plans
        </span>
        {!adding && editingId === null && (
          <button
            onClick={() => setAdding(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="h-2.5 w-2.5" /> Add plan
          </button>
        )}
      </div>
      {building.plans.length === 0 && !adding && (
        <p className="text-[10px] text-muted-foreground italic">No plans.</p>
      )}
      {building.plans.length > 0 && (
        <div className="space-y-0.5">
          {building.plans.map(p =>
            editingId === p.id ? (
              <div key={p.id} className="grid grid-cols-12 gap-1 items-center">
                <Input value={name} onChange={e => setName(e.target.value)} className="col-span-5 h-6 text-[11px]" />
                <Input type="number" value={sqft} onChange={e => setSqft(e.target.value)} className="col-span-3 h-6 text-[11px]" />
                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-3 h-6 text-[11px]" />
                <div className="col-span-1 flex items-center gap-0.5">
                  <button onClick={() => updateMut.mutate(p.id)} className="p-0.5 text-primary"><Check className="h-3 w-3" /></button>
                  <button onClick={reset} className="p-0.5 text-muted-foreground"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="grid grid-cols-12 gap-1 items-center text-[11px]">
                <div className="col-span-5 font-medium truncate">{p.planName}</div>
                <div className="col-span-3 text-muted-foreground">{p.squareFootage} sqft</div>
                <div className="col-span-3 text-muted-foreground">{fmtCurrency(p.amount)}</div>
                <div className="col-span-1 flex items-center gap-0.5">
                  <button onClick={() => startEdit(p)} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-2.5 w-2.5" /></button>
                  <button onClick={() => deleteMut.mutate(p.id)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-2.5 w-2.5" /></button>
                </div>
              </div>
            )
          )}
        </div>
      )}
      {adding && (
        <div className="grid grid-cols-12 gap-1 items-center mt-1">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Plan name"
            className="col-span-5 h-6 text-[11px]"
            autoFocus
          />
          <Input
            type="number"
            value={sqft}
            onChange={e => setSqft(e.target.value)}
            placeholder="Sq ft"
            className="col-span-3 h-6 text-[11px]"
          />
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Price"
            className="col-span-3 h-6 text-[11px]"
          />
          <div className="col-span-1 flex items-center gap-0.5">
            <button
              onClick={() => createMut.mutate()}
              disabled={!name.trim() || createMut.isPending}
              className="p-0.5 text-primary"
            >
              <Check className="h-3 w-3" />
            </button>
            <button onClick={reset} className="p-0.5 text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add PO dialog ─────────────────────────────────────────────────────────────

const NEW_SENTINEL = '__new__'

function AddPoDialog({
  projectId,
  buildings,
  onClose,
  onCreated,
}: {
  projectId: number
  buildings: Building[]
  onClose:   () => void
  onCreated: () => void
}) {
  const qc = useQueryClient()

  // Building selection: existing id (as string), '__new__', or ''
  const [buildingValue,   setBuildingValue]   = useState('')
  const [newBuildingName, setNewBuildingName] = useState('')

  // Lot selection
  const [lotValue,        setLotValue]        = useState('')
  const [newLotName,      setNewLotName]      = useState('')

  const [orderNumber, setOrderNumber] = useState('')
  const [amount,      setAmount]      = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const isNewBuilding    = buildingValue === NEW_SENTINEL
  const selectedBuilding = buildings.find(b => b.id === Number(buildingValue))
  const lots             = selectedBuilding?.lots ?? []
  const isNewLot         = lotValue === NEW_SENTINEL || isNewBuilding

  function handleBuildingChange(val: string) {
    setBuildingValue(val)
    setLotValue('')
    setNewLotName('')
    // If switching to new building, pre-select new lot mode
    if (val === NEW_SENTINEL) setLotValue(NEW_SENTINEL)
  }

  const canSubmit = (
    (isNewBuilding ? newBuildingName.trim() : buildingValue !== '') &&
    (isNewLot      ? newLotName.trim()      : lotValue !== '')      &&
    orderNumber.trim() &&
    amount !== '' && !Number.isNaN(Number(amount)) && Number(amount) >= 0
  )

  async function handleSubmit() {
    setSubmitting(true)
    try {
      let resolvedBuildingId: number
      let resolvedLotId:      number

      if (isNewBuilding) {
        const b = await buildingApi.create(projectId, { name: newBuildingName.trim(), description: '' })
        resolvedBuildingId = b.id
      } else {
        resolvedBuildingId = Number(buildingValue)
      }

      if (isNewLot) {
        const l = await lotApi.create(resolvedBuildingId, { name: newLotName.trim(), description: '', planId: null })
        resolvedLotId = l.id
      } else {
        resolvedLotId = Number(lotValue)
      }

      await purchaseOrderApi.create(projectId, {
        lotId:       resolvedLotId,
        orderNumber: orderNumber.trim(),
        amount:      Number(amount),
      })

      qc.invalidateQueries({ queryKey: ['buildings', projectId] })
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create purchase order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Building */}
          <div>
            <Label className="text-sm">Building</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={buildingValue}
              onChange={e => handleBuildingChange(e.target.value)}
            >
              <option value="">Select building…</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value={NEW_SENTINEL}>＋ New building…</option>
            </select>
            {isNewBuilding && (
              <Input
                className="mt-1.5"
                placeholder="Building name"
                value={newBuildingName}
                onChange={e => setNewBuildingName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* Lot */}
          <div>
            <Label className="text-sm">Lot</Label>
            {isNewBuilding ? (
              // New building → can only create a new lot
              <Input
                className="mt-1"
                placeholder="Lot name"
                value={newLotName}
                onChange={e => setNewLotName(e.target.value)}
              />
            ) : (
              <>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={lotValue}
                  onChange={e => { setLotValue(e.target.value); setNewLotName('') }}
                  disabled={!buildingValue}
                >
                  <option value="">Select lot…</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                  {buildingValue && <option value={NEW_SENTINEL}>＋ New lot…</option>}
                </select>
                {lotValue === NEW_SENTINEL && (
                  <Input
                    className="mt-1.5"
                    placeholder="Lot name"
                    value={newLotName}
                    onChange={e => setNewLotName(e.target.value)}
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          {/* Order Number */}
          <div>
            <Label className="text-sm">Order Number</Label>
            <Input
              className="mt-1"
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              placeholder="PO-12345"
            />
          </div>

          {/* Amount */}
          <div>
            <Label className="text-sm">Amount</Label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? 'Creating…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Purchase Orders tab ───────────────────────────────────────────────────────

function PurchaseOrdersTab({ projectId }: { projectId: number }) {
  const qc            = useQueryClient()
  const [addOpen,        setAddOpen]        = useState(false)
  const [importOpen,     setImportOpen]     = useState(false)
  const [manageStatuses, setManageStatuses] = useState(false)
  const [statusFilters,  setStatusFilters]  = useState<string[]>([])
  const [editingPo,      setEditingPo]      = useState<PurchaseOrder | null>(null)
  const [editNumber,     setEditNumber]     = useState('')
  const [editAmount,     setEditAmount]     = useState('')
  const [sortKey,        setSortKey]        = useState<'orderNumber' | 'building' | 'lot' | 'amount' | null>(null)
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('asc')

  const { data: qbStatus } = useQuery({
    queryKey: ['qb-status'],
    queryFn:  () => quickBooksApi.getStatus(),
    staleTime: 60_000,
  })

  const { data: buildings = [] } = useQuery({
    queryKey: ['buildings', projectId],
    queryFn:  () => buildingApi.getAll(projectId),
  })

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', projectId],
    queryFn:  () => purchaseOrderApi.getAll(projectId),
  })

  const { data: poStatuses = [] } = useQuery<PurchaseOrderStatus[]>({
    queryKey: ['po-statuses'],
    queryFn:  purchaseOrderStatusApi.getAll,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['purchase-orders', projectId] })
    qc.invalidateQueries({ queryKey: ['project-detail', projectId] })
  }

  const patchInternalStatusMut = useMutation({
    mutationFn: ({ poId, statusId }: { poId: number; statusId: number | null }) =>
      purchaseOrderStatusApi.patchOnPo(projectId, poId, statusId),
    onSuccess: invalidate,
    onError:   () => toast.error('Failed to update status.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseOrderApi.delete(projectId, id),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to delete purchase order.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { orderNumber: string; amount: number } }) =>
      purchaseOrderApi.update(projectId, id, data),
    onSuccess:  () => { setEditingPo(null); invalidate() },
    onError:    () => toast.error('Failed to update purchase order.'),
  })

  const syncOneMut = useMutation({
    mutationFn: (id: number) => purchaseOrderApi.syncOne(projectId, id),
    onSuccess:  () => { toast.success('Status synced.'); invalidate() },
    onError:    () => toast.error('QuickBooks sync failed.'),
  })

  const syncAllMut = useMutation({
    mutationFn: () => purchaseOrderApi.syncAll(projectId),
    onSuccess:  () => { toast.success('All statuses synced.'); invalidate() },
    onError:    () => toast.error('QuickBooks sync failed.'),
  })

  const qbConnected = qbStatus?.connected ?? false
  const filteredPos = statusFilters.length > 0
    ? pos.filter(p => statusFilters.includes(p.qbStatus))
    : pos
  const totalAmount = filteredPos.reduce((s, p) => s + p.amount, 0)

  function toggleStatusFilter(s: string) {
    setStatusFilters(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedPos = useMemo(() => {
    if (!sortKey) return filteredPos
    return [...filteredPos].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'orderNumber': cmp = a.orderNumber.localeCompare(b.orderNumber); break
        case 'building':    cmp = a.buildingName.localeCompare(b.buildingName); break
        case 'lot':         cmp = a.lotName.localeCompare(b.lotName); break
        case 'amount':      cmp = a.amount - b.amount; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredPos, sortKey, sortDir])

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-1 text-muted-foreground/50" />
    return sortDir === 'asc'
      ? <ArrowUp   className="inline h-3 w-3 ml-1 text-foreground" />
      : <ArrowDown className="inline h-3 w-3 ml-1 text-foreground" />
  }

  function exportToExcel() {
    const rows = filteredPos.map(po => ({
      'Order #':  po.orderNumber,
      'Building': po.buildingName,
      'Lot':      po.lotName,
      'Amount':   po.amount,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 14 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders')
    XLSX.writeFile(wb, `purchase-orders-${projectId}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {qbConnected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3 w-3" /> QuickBooks Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/30 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <AlertCircle className="h-3 w-3" /> QuickBooks Not Connected
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!qbConnected || syncAllMut.isPending || pos.length === 0}
            onClick={() => syncAllMut.mutate()}
            title={!qbConnected ? 'Connect QuickBooks in Settings' : undefined}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncAllMut.isPending ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManageStatuses(true)} title="Manage internal statuses">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Statuses
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={filteredPos.length === 0}
            title="Export current results to Excel"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add PO
          </Button>
        </div>
      </div>

      {/* QB Status filter pills (multi-select) */}
      {pos.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-0.5">QB Status:</span>
          {QB_STATUSES.filter(s => pos.some(p => p.qbStatus === s)).map(s => (
            <button
              key={s}
              onClick={() => toggleStatusFilter(s)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium border transition-colors ${
                statusFilters.includes(s)
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
          {statusFilters.length > 0 && (
            <button
              onClick={() => setStatusFilters([])}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Total */}
      {filteredPos.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {filteredPos.length} purchase order{filteredPos.length !== 1 ? 's' : ''}
          {statusFilters.length > 0 && ` · ${statusFilters.join(', ')}`} · Total: {fmtCurrency(totalAmount)}
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
        </div>
      ) : filteredPos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">No purchase orders match the selected filter.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('orderNumber')}>
                  Order # <SortIcon col="orderNumber" />
                </TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('building')}>
                  Building <SortIcon col="building" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('lot')}>
                  Lot <SortIcon col="lot" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('amount')}>
                  Amount <SortIcon col="amount" />
                </TableHead>
                <TableHead>QB Status</TableHead>
                <TableHead>Internal Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPos.map(po => (
                <TableRow key={po.id}>
                  {editingPo?.id === po.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={editNumber}
                          onChange={e => setEditNumber(e.target.value)}
                          className="h-7 text-sm w-32"
                          autoFocus
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.invoiceNumber ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.buildingName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.lotName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="h-7 text-sm w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${QB_STATUS_COLORS[po.qbStatus] ?? ''}`}>
                          {po.qbStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.internalStatusName ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(po.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateMut.mutate({
                              id: po.id,
                              data: { orderNumber: editNumber.trim(), amount: Number(editAmount) },
                            })}
                            disabled={!editNumber.trim() || updateMut.isPending}
                            className="p-1 rounded text-primary hover:bg-primary/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingPo(null)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium text-sm">{po.orderNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.invoiceNumber ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.buildingName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.lotName}</TableCell>
                      <TableCell className="text-sm">{fmtCurrency(po.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${QB_STATUS_COLORS[po.qbStatus] ?? ''}`}>
                          {po.qbStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          value={po.internalStatusId ?? ''}
                          onChange={e => patchInternalStatusMut.mutate({
                            poId: po.id,
                            statusId: e.target.value ? Number(e.target.value) : null,
                          })}
                          className="text-xs rounded border border-input bg-background px-1.5 py-0.5 max-w-[120px]"
                          style={po.internalStatusColor ? { borderColor: po.internalStatusColor, color: po.internalStatusColor } : undefined}
                        >
                          <option value="">— None —</option>
                          {poStatuses.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(po.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingPo(po); setEditNumber(po.orderNumber); setEditAmount(String(po.amount)) }}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => syncOneMut.mutate(po.id)}
                            disabled={!qbConnected || syncOneMut.isPending}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
                            title={qbConnected ? 'Sync status from QuickBooks' : 'Connect QuickBooks in Settings'}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMut.mutate(po.id)}
                            disabled={deleteMut.isPending}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {addOpen && (
        <AddPoDialog
          projectId={projectId}
          buildings={buildings}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['purchase-orders', projectId] })
            qc.invalidateQueries({ queryKey: ['project-detail', projectId] })
          }}
        />
      )}

      {importOpen && (
        <ImportPoModal
          projectId={projectId}
          onClose={() => setImportOpen(false)}
        />
      )}

      {manageStatuses && (
        <ManagePoStatusesDialog onClose={() => setManageStatuses(false)} />
      )}
    </div>
  )
}

// ── Buildings & Lots tab ──────────────────────────────────────────────────────

function BuildingsTab({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const [addingBuilding, setAddingBuilding] = useState(false)
  const [importOpen,     setImportOpen]     = useState(false)
  const [newBuildName,   setNewBuildName]   = useState('')
  const [newBuildDesc,   setNewBuildDesc]   = useState('')

  // Persist expanded state per building in localStorage
  const storageKey = `bos-buildings-open-${projectId}`
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') }
    catch { return {} }
  })

  function setExpanded(id: number, value: boolean) {
    setExpandedMap(prev => {
      const next = { ...prev, [id]: value }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  function isExpanded(id: number) {
    return expandedMap[id] !== false // default open
  }

  const { data: buildings = [], isLoading } = useQuery({
    queryKey: ['buildings', projectId],
    queryFn:  () => buildingApi.getAll(projectId),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['buildings', projectId] })
    qc.invalidateQueries({ queryKey: ['project-detail', projectId] })
  }

  function expandAll() {
    const next = Object.fromEntries(buildings.map(b => [b.id, true]))
    setExpandedMap(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function collapseAll() {
    const next = Object.fromEntries(buildings.map(b => [b.id, false]))
    setExpandedMap(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const addBuildMut = useMutation({
    mutationFn: () => buildingApi.create(projectId, { name: newBuildName.trim(), description: newBuildDesc.trim() }),
    onSuccess:  () => { setAddingBuilding(false); setNewBuildName(''); setNewBuildDesc(''); invalidate() },
    onError:    () => toast.error('Failed to add building.'),
  })

  const reorderBuildMut = useMutation({
    mutationFn: (orderedIds: number[]) => buildingApi.reorder(projectId, orderedIds),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to reorder buildings.'),
  })

  function moveBuilding(index: number, dir: -1 | 1) {
    const ids = buildings.map(b => b.id)
    const target = index + dir
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderBuildMut.mutate(ids)
  }

  return (
    <div className="space-y-3">
      {/* Expand / Collapse All */}
      {buildings.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expand All
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Collapse All
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : buildings.length === 0 && !addingBuilding ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No buildings yet.</p>
        </div>
      ) : (
        buildings.map((b, i) => (
          <BuildingCard
            key={b.id}
            building={b}
            projectId={projectId}
            expanded={isExpanded(b.id)}
            onToggle={() => setExpanded(b.id, !isExpanded(b.id))}
            onChanged={invalidate}
            onMoveUp={() => moveBuilding(i, -1)}
            onMoveDown={() => moveBuilding(i, 1)}
            isFirst={i === 0}
            isLast={i === buildings.length - 1}
          />
        ))
      )}

      {addingBuilding ? (
        <div className="flex items-center gap-2 px-2 py-1">
          <Input
            value={newBuildName}
            onChange={e => setNewBuildName(e.target.value)}
            placeholder="Building name"
            className="h-7 text-sm w-48"
            autoFocus
          />
          <Input
            value={newBuildDesc}
            onChange={e => setNewBuildDesc(e.target.value)}
            placeholder="Description"
            className="h-7 text-sm w-48"
          />
          <button
            onClick={() => addBuildMut.mutate()}
            disabled={!newBuildName.trim() || addBuildMut.isPending}
            className="p-1 rounded text-primary hover:bg-primary/10"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setAddingBuilding(false); setNewBuildName('') }} className="p-1 rounded text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const nums = buildings.map(b => parseInt(b.name)).filter(n => !isNaN(n))
            setNewBuildName(String((nums.length ? Math.max(...nums) : buildings.length) + 1))
            setAddingBuilding(true)
          }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Building
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
          </Button>
        </div>
      )}

      {importOpen && (
        <ImportBuildingsModal
          projectId={projectId}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  )
}

// ── Project Fixtures tab (aggregate) ─────────────────────────────────────────

function ProjectFixturesTab({ projectId }: { projectId: number }) {
  const { data: fixtures = [], isLoading } = useQuery({
    queryKey: ['project-fixtures', projectId],
    queryFn:  () => fixtureApi.getByProject(projectId),
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
  }

  if (fixtures.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No fixtures yet. Add them from the Buildings &amp; Lots tab.
        </p>
      </div>
    )
  }

  // Group by code for a summary view
  const summary = fixtures.reduce<Record<string, { description: string; totalQty: number; locations: string[] }>>(
    (acc, f) => {
      if (!acc[f.code]) {
        acc[f.code] = { description: f.description, totalQty: 0, locations: [] }
      }
      acc[f.code].totalQty += f.quantity
      const loc = [f.buildingName, f.locationName].filter(Boolean).join(' › ')
      if (loc) acc[f.code].locations.push(`${loc} ×${f.quantity}`)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {fixtures.length} fixture{fixtures.length !== 1 ? 's' : ''} across {
          [...new Set(fixtures.map(f => f.buildingId))].length
        } building{[...new Set(fixtures.map(f => f.buildingId))].length !== 1 ? 's' : ''}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fixtures.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-medium font-mono text-sm">{f.code}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.description || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.buildingName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.locationName ?? '—'}</TableCell>
                <TableCell className="text-sm text-right">{f.quantity}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{f.note || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary by code */}
      {Object.keys(summary).length > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Summary by Code</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Used In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(summary).sort(([a], [b]) => a.localeCompare(b)).map(([code, s]) => (
                  <TableRow key={code}>
                    <TableCell className="font-medium font-mono text-sm">{code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.description || '—'}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{s.totalQty}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.locations.length > 0 ? s.locations.join(', ') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const qc = useQueryClient()
  const [tab,              setTab]              = useState<Tab>('overview')
  const [editOpen,         setEditOpen]         = useState(false)
  const [createTicketOpen, setCreateTicketOpen] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn:  () => projectDetailApi.getById(projectId),
    enabled:  !Number.isNaN(projectId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link to="/projects" className="text-sm text-primary hover:underline">
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
          <Badge
            variant="outline"
            className={`text-[11px] ${STATUS_COLORS[project.status] ?? ''}`}
          >
            {project.status}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateTicketOpen(true)}
            >
              <TicketCheck className="h-3.5 w-3.5 mr-1.5" /> New Ticket
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link to={`/clients/${project.clientId}`} className="hover:underline text-foreground">
            {project.clientName}
          </Link>
          {(project.startDate || project.endDate) && (
            <span> · {fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {(['overview', 'buildings', 'estimates', 'pos', 'fixtures', 'options'] as Tab[]).map(t => {
            const labels: Record<Tab, string> = {
              overview:  'Overview',
              buildings: 'Buildings & Lots',
              estimates: 'Estimates',
              pos:       'Purchase Orders',
              fixtures:  'Fixtures',
              options:   'Options',
            }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {labels[t]}
                {t === 'pos' && project.purchaseOrderCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {project.purchaseOrderCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Description */}
          {project.description && (
            <div>
              <h3 className="text-sm font-medium mb-1">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Buildings',        value: project.buildingCount },
              { label: 'Lots',             value: project.lotCount },
              { label: 'Purchase Orders',  value: project.purchaseOrderCount },
              { label: 'Total PO Amount',  value: fmtCurrency(project.totalPoAmount) },
            ].map(s => (
              <div key={s.label} className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Assigned contacts */}
          {project.assignedContacts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Assigned Contacts</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {project.assignedContacts.map(c => (
                  <div key={c.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{c.name}</p>
                    {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                    {c.email && <p className="text-xs text-muted-foreground mt-1">{c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carried over from a converted Proposal */}
          {project.sourceProposalId && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">From Proposal</h3>
                <Badge variant="outline" className="text-[10px]">Converted</Badge>
              </div>
              {project.sourceLibraryTitle && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source Library</p>
                  <p className="text-sm">{project.sourceLibraryTitle}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(project.address || project.city) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Address</p>
                    <p className="text-sm">{[project.address, project.city].filter(Boolean).join(', ')}</p>
                  </div>
                )}
                {project.productStandards && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Product Standards</p>
                    <p className="text-sm">{project.productStandards}</p>
                  </div>
                )}
                {project.version && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Version</p>
                    <p className="text-sm">{project.version}</p>
                  </div>
                )}
              </div>
              {project.buyerUpgrades && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Buyer Upgrades</p>
                  <p className="text-sm whitespace-pre-wrap">{project.buyerUpgrades}</p>
                </div>
              )}
              {project.revisionsAfterLaunch && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revisions After Launch</p>
                  <p className="text-sm whitespace-pre-wrap">{project.revisionsAfterLaunch}</p>
                </div>
              )}
              {project.customUpgrades.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Custom Upgrades</p>
                  <div className="flex flex-wrap gap-1">
                    {project.customUpgrades.map(u => (
                      <Badge
                        key={u.customUpgradeId}
                        variant={u.isEnabled ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {u.isEnabled ? '✓ ' : '○ '}{u.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'buildings' && <BuildingsTab projectId={projectId} />}
      {tab === 'estimates' && <EstimatesTab projectId={projectId} />}
      {tab === 'pos'       && <PurchaseOrdersTab projectId={projectId} />}
      {tab === 'fixtures'  && <ProjectFixturesTab projectId={projectId} />}
      {tab === 'options'   && <ProjectOptionsPanel projectId={projectId} />}

      {editOpen && (
        <EditProjectDialog
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['project-detail', projectId] })}
        />
      )}

      <CreateTicketDialog
        open={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        prefill={{ projectId }}
      />
    </div>
  )
}
