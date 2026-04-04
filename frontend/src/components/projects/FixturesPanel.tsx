import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, Wrench, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fixtureApi, fixtureLocationApi, type Fixture } from '@/api/fixtures'
import ManageFixtureLocationsDialog from './ManageFixtureLocationsDialog'

interface Props {
  buildingId: number
}

const EMPTY_FORM = {
  locationId:  null as number | null,
  code:        '',
  description: '',
  quantity:    1,
  note:        '',
}

// Separate row component for cleaner edit state management
function FixtureRow({
  fixture,
  buildingId,
  onChanged,
}: {
  fixture:    Fixture
  buildingId: number
  onChanged:  () => void
}) {
  const [editing, setEditing] = useState(false)

  const { data: locations = [] } = useQuery({
    queryKey: ['fixture-locations'],
    queryFn:  fixtureLocationApi.getAll,
  })

  const [form, setForm] = useState({
    locationId:  fixture.locationId,
    code:        fixture.code,
    description: fixture.description,
    quantity:    fixture.quantity,
    note:        fixture.note,
  })

  const updateMut = useMutation({
    mutationFn: () => fixtureApi.update(buildingId, fixture.id, form),
    onSuccess:  () => { setEditing(false); onChanged() },
    onError:    () => toast.error('Failed to update fixture.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => fixtureApi.delete(buildingId, fixture.id),
    onSuccess:  onChanged,
    onError:    () => toast.error('Failed to delete fixture.'),
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  if (editing) {
    return (
      <div className="space-y-2 p-3 rounded-md border border-border bg-muted/30 my-1">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Code *</label>
            <Input
              value={form.code}
              onChange={e => set('code', e.target.value)}
              className="h-7 text-sm mt-0.5"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Quantity *</label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={e => set('quantity', Math.max(1, Number(e.target.value)))}
              className="h-7 text-sm mt-0.5"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Description</label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="h-7 text-sm mt-0.5"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Location</label>
            <select
              value={form.locationId ?? ''}
              onChange={e => set('locationId', e.target.value ? Number(e.target.value) : null)}
              className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm mt-0.5"
            >
              <option value="">— None —</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Note</label>
            <Textarea
              value={form.note}
              onChange={e => set('note', e.target.value)}
              rows={2}
              className="text-sm mt-0.5 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => updateMut.mutate()}
            disabled={!form.code.trim() || updateMut.isPending}
          >
            <Check className="h-3 w-3 mr-1" /> Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(false)}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium font-mono">{fixture.code}</span>
          <span className="text-xs text-muted-foreground">×{fixture.quantity}</span>
          {fixture.locationName && (
            <span className="text-xs rounded-full bg-secondary px-1.5 py-0.5 text-secondary-foreground">
              {fixture.locationName}
            </span>
          )}
        </div>
        {fixture.description && (
          <p className="text-xs text-muted-foreground truncate">{fixture.description}</p>
        )}
        {fixture.note && (
          <p className="text-xs text-muted-foreground/70 italic truncate">{fixture.note}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => {
            setForm({
              locationId:  fixture.locationId,
              code:        fixture.code,
              description: fixture.description,
              quantity:    fixture.quantity,
              note:        fixture.note,
            })
            setEditing(true)
          }}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Edit fixture"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
          title="Delete fixture"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function FixturesPanel({ buildingId }: Props) {
  const qc = useQueryClient()
  const [adding,          setAdding]          = useState(false)
  const [managingLocs,    setManagingLocs]    = useState(false)
  const [addForm,         setAddForm]         = useState(EMPTY_FORM)

  const { data: fixtures = [], isLoading } = useQuery({
    queryKey: ['fixtures', buildingId],
    queryFn:  () => fixtureApi.getByBuilding(buildingId),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['fixture-locations'],
    queryFn:  fixtureLocationApi.getAll,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['fixtures', buildingId] })
  }

  const createMut = useMutation({
    mutationFn: () => fixtureApi.create(buildingId, addForm),
    onSuccess:  () => { setAdding(false); setAddForm(EMPTY_FORM); invalidate() },
    onError:    () => toast.error('Failed to add fixture.'),
  })

  if (isLoading) return null

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Fixtures
          {fixtures.length > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {fixtures.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setManagingLocs(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Manage locations"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {fixtures.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground py-1">No fixtures yet.</p>
      )}

      <div className="space-y-0.5">
        {fixtures.map(f => (
          <FixtureRow key={f.id} fixture={f} buildingId={buildingId} onChanged={invalidate} />
        ))}
      </div>

      {adding ? (
        <div className="mt-1 space-y-2 p-3 rounded-md border border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Code *</label>
              <Input
                value={addForm.code}
                onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                placeholder="e.g. FIX-001"
                className="h-7 text-sm mt-0.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quantity *</label>
              <Input
                type="number"
                min={1}
                value={addForm.quantity}
                onChange={e => setAddForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                className="h-7 text-sm mt-0.5"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description"
                className="h-7 text-sm mt-0.5"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Location</label>
              <select
                value={addForm.locationId ?? ''}
                onChange={e => setAddForm(f => ({ ...f, locationId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm mt-0.5"
              >
                <option value="">— None —</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Note</label>
              <Textarea
                value={addForm.note}
                onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Optional note"
                rows={2}
                className="text-sm mt-0.5 resize-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => createMut.mutate()}
              disabled={!addForm.code.trim() || createMut.isPending}
            >
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => { setAdding(false); setAddForm(EMPTY_FORM) }}
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add fixture
        </button>
      )}

      {managingLocs && (
        <ManageFixtureLocationsDialog onClose={() => setManagingLocs(false)} />
      )}
    </div>
  )
}
