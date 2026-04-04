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
import { fixtureLocationApi, type FixtureLocation } from '@/api/fixtures'

interface Props {
  onClose: () => void
}

export default function ManageFixtureLocationsDialog({ onClose }: Props) {
  const qc = useQueryClient()

  const { data: locations = [] } = useQuery({
    queryKey: ['fixture-locations'],
    queryFn:  fixtureLocationApi.getAll,
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName,  setEditName]  = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName,   setNewName]   = useState('')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['fixture-locations'] })
  }

  const createMut = useMutation({
    mutationFn: () => fixtureLocationApi.create(newName.trim()),
    onSuccess:  () => { invalidate(); setAddingNew(false); setNewName('') },
    onError:    () => toast.error('Failed to create location.'),
  })

  const updateMut = useMutation({
    mutationFn: (loc: FixtureLocation) => fixtureLocationApi.update(loc.id, editName.trim()),
    onSuccess:  () => { invalidate(); setEditingId(null) },
    onError:    () => toast.error('Failed to update location.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => fixtureLocationApi.delete(id),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to delete location.'),
  })

  function startEdit(loc: FixtureLocation) {
    setEditingId(loc.id)
    setEditName(loc.name)
    setAddingNew(false)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Fixture Locations</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              {editingId === loc.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => updateMut.mutate(loc)}
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
                  <span className="text-sm flex-1">{loc.name}</span>
                  <button
                    onClick={() => startEdit(loc)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(loc.id)}
                    disabled={deleteMut.isPending}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {locations.length === 0 && !addingNew && (
            <p className="text-sm text-muted-foreground py-2 text-center">No locations yet.</p>
          )}

          {addingNew ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Kitchen, Garage"
                className="h-7 text-sm flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMut.mutate() }}
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
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Location
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
