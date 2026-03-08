import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import {
  useUnitStatuses,
  useCreateUnitStatus,
  useUpdateUnitStatus,
  useDeleteUnitStatus,
} from '@/hooks/useUnitStatuses'
import type { GlossaryUnitStatus } from '@/api/unitStatuses'
import { STATUS_COLORS } from './UnitFormFields'

// ── Color swatch picker ──────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {STATUS_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-full border-2 transition-all shrink-0"
          style={{
            backgroundColor: c,
            borderColor: value === c ? '#000' : 'transparent',
          }}
          title={c}
        />
      ))}
    </div>
  )
}

// ── Inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  status,
  onSave,
  onCancel,
  isSaving,
}: {
  status: GlossaryUnitStatus
  onSave: (name: string, color: string) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [name,  setName]  = useState(status.name)
  const [color, setColor] = useState(status.color)

  return (
    <TableRow>
      <TableCell className="w-8">
        <span
          className="inline-block w-4 h-4 rounded-full border"
          style={{ backgroundColor: color }}
        />
      </TableCell>
      <TableCell className="space-y-1.5">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-7 text-sm"
          autoFocus
        />
        <ColorPicker value={color} onChange={setColor} />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!name.trim() || isSaving}
            onClick={() => onSave(name.trim(), color)}
            title="Save"
          >
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCancel}
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Add row ──────────────────────────────────────────────────────────────────

function AddRow({
  onAdd,
  isAdding,
}: {
  onAdd: (name: string, color: string) => void
  isAdding: boolean
}) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState(STATUS_COLORS[6])

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd(name.trim(), color)
    setName('')
    setColor(STATUS_COLORS[6])
  }

  return (
    <TableRow>
      <TableCell className="w-8">
        <span
          className="inline-block w-4 h-4 rounded-full border"
          style={{ backgroundColor: color }}
        />
      </TableCell>
      <TableCell className="space-y-1.5">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New status name…"
          className="h-7 text-sm"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <ColorPicker value={color} onChange={setColor} />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!name.trim() || isAdding}
          onClick={handleAdd}
        >
          {isAdding ? 'Adding…' : 'Add'}
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ── Main dialog ──────────────────────────────────────────────────────────────

interface StatusManagerDialogProps {
  open:    boolean
  onClose: () => void
}

export default function StatusManagerDialog({ open, onClose }: StatusManagerDialogProps) {
  const { data: statuses = [], isLoading } = useUnitStatuses()
  const createStatus = useCreateUnitStatus()
  const updateStatus = useUpdateUnitStatus()
  const deleteStatus = useDeleteUnitStatus()

  const [editingId,      setEditingId]      = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const handleAdd = async (name: string, color: string) => {
    await createStatus.mutateAsync({ name, color })
  }

  const handleSave = async (id: number, name: string, color: string) => {
    await updateStatus.mutateAsync({ id, data: { name, color } })
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    await deleteStatus.mutateAsync(id)
    setConfirmDeleteId(null)
  }

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Statuses</DialogTitle>
          <DialogDescription>
            Create and edit the status labels that can be assigned to glossary units.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground text-center">Loading…</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map(status =>
                  editingId === status.id ? (
                    <EditRow
                      key={status.id}
                      status={status}
                      onSave={(name, color) => handleSave(status.id, name, color)}
                      onCancel={() => setEditingId(null)}
                      isSaving={updateStatus.isPending}
                    />
                  ) : confirmDeleteId === status.id ? (
                    <TableRow key={status.id} className="bg-red-50 dark:bg-red-950/20">
                      <TableCell />
                      <TableCell className="text-sm">
                        <span className="text-destructive font-medium">Delete "{status.name}"?</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          This will unassign it from all units.
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={deleteStatus.isPending}
                            onClick={() => handleDelete(status.id)}
                          >
                            {deleteStatus.isPending ? 'Deleting…' : 'Delete'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={status.id}>
                      <TableCell>
                        <span
                          className="inline-block w-4 h-4 rounded-full border"
                          style={{ backgroundColor: status.color }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{status.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingId(status.id); setConfirmDeleteId(null) }}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { setConfirmDeleteId(status.id); setEditingId(null) }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}

                {/* Add new status row */}
                <AddRow
                  onAdd={handleAdd}
                  isAdding={createStatus.isPending}
                />
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
