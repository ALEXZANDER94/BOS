import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  customUpgradeApi,
  type CustomUpgrade,
  type CustomUpgradeUsage,
} from '@/api/customUpgrades'

// Custom upgrades manager — lives inside ClientOptionsTab. Shows the union of
// (this client's upgrades + global upgrades). Globals are visible but only
// editable from any client (changes apply everywhere).
export default function CustomUpgradesPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: upgrades = [], isLoading } = useQuery({
    queryKey: ['custom-upgrades', clientId],
    queryFn:  () => customUpgradeApi.getForClient(clientId),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => customUpgradeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-upgrades', clientId] })
      toast.success('Upgrade deleted')
    },
    onError: (err: any) => {
      const status = err?.response?.status
      if (status === 409) {
        const usage = err.response.data as CustomUpgradeUsage
        const summary =
          `In use by ${usage.proposalCount} proposal(s), ${usage.projectCount} project(s), ` +
          `${usage.libraryCount} library/libraries. Remove the upgrade from each before deleting.`
        toast.error(summary, { duration: 8000 })
      } else {
        toast.error('Failed to delete upgrade')
      }
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Custom Upgrades</h3>
          <p className="text-xs text-muted-foreground">
            Toggleable add-ons that appear on this client's proposals and projects.
            Upgrades marked as <span className="font-semibold">Global</span> are shared across every client.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddingNew(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Upgrade
        </Button>
      </div>

      {addingNew && (
        <UpgradeForm
          clientId={clientId}
          mode="create"
          onClose={() => setAddingNew(false)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : upgrades.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No custom upgrades yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">Scope</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {upgrades.map(u =>
                editingId === u.id ? (
                  <tr key={u.id}>
                    <td colSpan={4} className="p-2">
                      <UpgradeForm
                        clientId={clientId}
                        mode="edit"
                        upgrade={u}
                        onClose={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.description}</TableCell>
                    <TableCell>
                      {u.isGlobal ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400">
                          Global
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Client</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMut.mutate(u.id)}
                          disabled={deleteMut.isPending}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface UpgradeFormProps {
  clientId: number
  mode:     'create' | 'edit'
  upgrade?: CustomUpgrade
  onClose:  () => void
}

function UpgradeForm({ clientId, mode, upgrade, onClose }: UpgradeFormProps) {
  const qc = useQueryClient()
  const [name, setName] = useState(upgrade?.name ?? '')
  const [description, setDescription] = useState(upgrade?.description ?? '')
  const [isGlobal, setIsGlobal] = useState(upgrade?.isGlobal ?? false)

  const wasGlobal = upgrade?.isGlobal ?? false

  const saveMut = useMutation({
    mutationFn: () => {
      const data = {
        clientId: isGlobal ? null : clientId,
        isGlobal,
        name: name.trim(),
        description: description.trim(),
      }
      return mode === 'create'
        ? customUpgradeApi.create(data)
        : customUpgradeApi.update(upgrade!.id, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-upgrades', clientId] })
      toast.success(mode === 'create' ? 'Upgrade added' : 'Upgrade updated')
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data ?? 'Save failed')
    },
  })

  function handleSave() {
    if (!name.trim()) return
    // Demoting global → per-client could orphan toggles on other clients.
    if (mode === 'edit' && wasGlobal && !isGlobal) {
      const ok = confirm(
        'Changing this from Global to Client-only will hide it from every other client, ' +
        'and any toggles on their proposals/projects will become orphaned. Continue?'
      )
      if (!ok) return
    }
    saveMut.mutate()
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Scope</Label>
          <label className="flex items-center gap-2 h-8 text-sm">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={e => setIsGlobal(e.target.checked)}
            />
            Global (available to every client)
          </label>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={!name.trim() || saveMut.isPending} onClick={handleSave}>
          <Check className="mr-1 h-3 w-3" /> {saveMut.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
      </div>
    </div>
  )
}
