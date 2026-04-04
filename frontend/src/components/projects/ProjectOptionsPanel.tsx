import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { projectAddonAssignmentsApi, type ProjectAddonOption } from '@/api/clientAddons'
import AssignOptionsDialog from './AssignOptionsDialog'

function fmtAmount(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// ── Single assigned option row ────────────────────────────────────────────────

function AssignedRow({
  option, projectId,
}: {
  option:    ProjectAddonOption
  projectId: number
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [price,   setPrice]   = useState(option.price !== null ? String(option.price) : '')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['project-options', projectId] })
  }

  const updateMut = useMutation({
    mutationFn: () => projectAddonAssignmentsApi.upsert(
      projectId, option.addonId,
      price === '' ? null : parseFloat(price) || 0
    ),
    onSuccess: () => { setEditing(false); invalidate() },
    onError:   () => toast.error('Failed to update price.'),
  })

  const removeMut = useMutation({
    mutationFn: () => projectAddonAssignmentsApi.remove(projectId, option.addonId),
    onSuccess:  invalidate,
    onError:    () => toast.error('Failed to remove option.'),
  })

  if (editing) {
    return (
      <TableRow>
        <TableCell className="font-mono text-sm font-medium">{option.code}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{option.description}</TableCell>
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
              onClick={() => { setEditing(false); setPrice(option.price !== null ? String(option.price) : '') }}
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
    <TableRow>
      <TableCell className="font-mono text-sm font-medium">{option.code}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{option.description}</TableCell>
      <TableCell className="text-sm">{fmtAmount(option.price)}</TableCell>
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

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ProjectOptionsPanel({ projectId }: { projectId: number }) {
  const [assignOpen, setAssignOpen] = useState(false)

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['project-options', projectId],
    queryFn:  async () => {
      const all = await projectAddonAssignmentsApi.getOptions(projectId)
      return all.filter(o => o.isAssigned)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {options.length === 0 ? 'No options assigned to this project.' : `${options.length} option${options.length === 1 ? '' : 's'} assigned.`}
        </p>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Assign Options
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
      ) : options.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Price</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map(o => (
                <AssignedRow key={o.addonId} option={o} projectId={projectId} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No options assigned yet.</p>
          <p className="text-xs text-muted-foreground">Click "Assign Options" to get started.</p>
        </div>
      )}

      {assignOpen && (
        <AssignOptionsDialog projectId={projectId} onClose={() => setAssignOpen(false)} />
      )}
    </div>
  )
}
