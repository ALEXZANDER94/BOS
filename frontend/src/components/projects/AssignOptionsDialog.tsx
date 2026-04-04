import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { projectAddonAssignmentsApi, type ProjectAddonOption } from '@/api/clientAddons'

interface StagedItem {
  option: ProjectAddonOption
  price:  string
}

interface Props {
  projectId: number
  onClose:   () => void
}

export default function AssignOptionsDialog({ projectId, onClose }: Props) {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [staged, setStaged]   = useState<StagedItem[]>([])

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['project-addon-options', projectId],
    queryFn:  () => projectAddonAssignmentsApi.getOptions(projectId),
  })

  // Only show options not yet assigned (and not already staged)
  const stagedIds     = new Set(staged.map(s => s.option.addonId))
  const unassigned    = options.filter(o => !o.isAssigned && !stagedIds.has(o.addonId))
  const term          = search.trim().toLowerCase()
  const filteredList  = useMemo(() =>
    term
      ? unassigned.filter(o =>
          o.code.toLowerCase().includes(term) ||
          o.description.toLowerCase().includes(term)
        )
      : unassigned,
    [unassigned, term]
  )

  function stage(option: ProjectAddonOption) {
    setStaged(prev => [...prev, { option, price: '' }])
    setSearch('')
  }

  function unstage(addonId: number) {
    setStaged(prev => prev.filter(s => s.option.addonId !== addonId))
  }

  function setPrice(addonId: number, value: string) {
    setStaged(prev => prev.map(s => s.option.addonId === addonId ? { ...s, price: value } : s))
  }

  const bulkMut = useMutation({
    mutationFn: () => projectAddonAssignmentsApi.bulkAssign(
      projectId,
      staged.map(s => ({
        addonId: s.option.addonId,
        price:   s.price === '' ? null : parseFloat(s.price) || 0,
      }))
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-addon-options', projectId] })
      qc.invalidateQueries({ queryKey: ['project-options', projectId] })
      toast.success(`${staged.length} option${staged.length === 1 ? '' : 's'} assigned.`)
      onClose()
    },
    onError: () => toast.error('Failed to assign options.'),
  })

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Options</DialogTitle>
          <DialogDescription>
            Search and select options to assign to this project, then set a price for each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Search list */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search options…"
                className="pl-8 h-8 text-sm"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="rounded-md border overflow-y-auto max-h-52">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
              ) : filteredList.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {term ? `No options match "${search}".` : 'All options are already assigned.'}
                </p>
              ) : (
                <ul>
                  {filteredList.map(o => (
                    <li key={o.addonId}>
                      <button
                        onClick={() => stage(o)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors group"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="font-mono text-xs font-medium text-muted-foreground w-20 shrink-0">{o.code}</span>
                        <span className="text-sm truncate">{o.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Staged items */}
          {staged.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Selected <span className="text-muted-foreground font-normal">({staged.length})</span>
              </p>
              <div className="rounded-md border overflow-y-auto max-h-48">
                <ul className="divide-y">
                  {staged.map(s => (
                    <li key={s.option.addonId} className="flex items-center gap-2 px-3 py-2">
                      <span className="font-mono text-xs font-medium text-muted-foreground w-20 shrink-0">{s.option.code}</span>
                      <span className="text-sm flex-1 truncate">{s.option.description}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          value={s.price}
                          onChange={e => setPrice(s.option.addonId, e.target.value)}
                          placeholder="0.00"
                          className="h-7 text-sm w-24"
                        />
                        <button
                          onClick={() => unstage(s.option.addonId)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={staged.length === 0 || bulkMut.isPending}
            onClick={() => bulkMut.mutate()}
          >
            {bulkMut.isPending ? 'Assigning…' : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Confirm Assignment{staged.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
