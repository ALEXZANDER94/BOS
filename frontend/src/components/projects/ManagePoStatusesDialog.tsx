import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { purchaseOrderStatusApi, type PurchaseOrderStatus } from '@/api/projects'

const PRESET_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

interface Props {
  onClose: () => void
}

export default function ManagePoStatusesDialog({ onClose }: Props) {
  const qc = useQueryClient()

  const { data: statuses = [] } = useQuery({
    queryKey: ['po-statuses'],
    queryFn:  purchaseOrderStatusApi.getAll,
  })

  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [editName,    setEditName]    = useState('')
  const [editColor,   setEditColor]   = useState('#6b7280')
  const [addingNew,   setAddingNew]   = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState('#6b7280')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['po-statuses'] })
  }

  const createMut = useMutation({
    mutationFn: () => purchaseOrderStatusApi.create({ name: newName.trim(), color: newColor }),
    onSuccess:  () => { invalidate(); setAddingNew(false); setNewName(''); setNewColor('#6b7280') },
    onError:    () => toast.error('Failed to create status.'),
  })

  const updateMut = useMutation({
    mutationFn: (s: PurchaseOrderStatus) =>
      purchaseOrderStatusApi.update(s.id, { name: editName.trim(), color: editColor }),
    onSuccess:  () => { invalidate(); setEditingId(null) },
    onError:    () => toast.error('Failed to update status.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseOrderStatusApi.delete(id),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to delete status.'),
  })

  function startEdit(s: PurchaseOrderStatus) {
    setEditingId(s.id)
    setEditName(s.name)
    setEditColor(s.color)
    setAddingNew(false)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Internal Statuses</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          {statuses.map(s => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              {editingId === s.id ? (
                <>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => updateMut.mutate(s)}
                    disabled={!editName.trim() || updateMut.isPending}
                    className="p-1 rounded text-primary hover:bg-primary/10"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm flex-1">{s.name}</span>
                  <button
                    onClick={() => startEdit(s)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(s.id)}
                    disabled={deleteMut.isPending}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {statuses.length === 0 && !addingNew && (
            <p className="text-sm text-muted-foreground py-2 text-center">No statuses yet.</p>
          )}

          {addingNew ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <ColorPicker value={newColor} onChange={setNewColor} />
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Status name"
                className="h-7 text-sm flex-1"
                autoFocus
              />
              <button
                onClick={() => createMut.mutate()}
                disabled={!newName.trim() || createMut.isPending}
                className="p-1 rounded text-primary hover:bg-primary/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setAddingNew(false); setNewName('') }}
                className="p-1 rounded text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1"
              onClick={() => { setAddingNew(true); setEditingId(null) }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Status
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`h-4 w-4 rounded-full border-2 transition-transform ${
            value === c ? 'border-foreground scale-110' : 'border-transparent'
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  )
}
