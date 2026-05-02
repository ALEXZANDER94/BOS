import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { projectQbProjectApi } from '@/api/projects'

interface Props {
  projectId:           number
  currentQbProjectId:  string | null
  onClose:             () => void
}

export default function QbProjectPickerDialog({
  projectId, currentQbProjectId, onClose,
}: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: subs, isLoading, error } = useQuery({
    queryKey: ['project-qb-options', projectId],
    queryFn:  () => projectQbProjectApi.listOptions(projectId),
    staleTime: 60_000,
    retry:    false,
  })

  const filtered = useMemo(() => {
    const list = subs ?? []
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter(c => c.displayName.toLowerCase().includes(s))
  }, [subs, search])

  const selectMut = useMutation({
    mutationFn: (sub: { id: string; displayName: string }) =>
      projectQbProjectApi.set(projectId, sub.id, sub.displayName),
    onSuccess: () => {
      toast.success('QuickBooks Project linked.')
      qc.invalidateQueries({ queryKey: ['project-detail',     projectId] })
      qc.invalidateQueries({ queryKey: ['project-estimates',  projectId] })
      qc.invalidateQueries({ queryKey: ['project-invoices',   projectId] })
      onClose()
    },
    onError: () => toast.error('Failed to link QuickBooks Project.'),
  })

  const fetchError = error
    ? axios.isAxiosError(error)
      ? (error.response?.data as { message?: string } | undefined)?.message
          ?? 'Failed to load QuickBooks Projects.'
      : 'Failed to load QuickBooks Projects.'
    : null

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Link to QuickBooks Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Pick the QuickBooks Project (sub-customer) under this client's QuickBooks customer.
            Estimates and invoices filed against the selected QB Project will be scoped to this BOS Project.
          </p>

          <div className="relative">
            <Input
              placeholder="Search QuickBooks Projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading from QuickBooks…
            </div>
          ) : fetchError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {fetchError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
              {subs && subs.length === 0
                ? 'No QuickBooks Projects exist under this client\'s customer yet.'
                : 'No matches.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden max-h-[55vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(sub => {
                    const isCurrent = sub.id === currentQbProjectId
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="text-sm">
                          {sub.displayName}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] text-muted-foreground">(current)</span>
                          )}
                          {sub.parentDisplayName && (
                            <p className="text-[10px] text-muted-foreground">
                              under {sub.parentDisplayName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isCurrent ? 'ghost' : 'outline'}
                            disabled={isCurrent || selectMut.isPending}
                            onClick={() => selectMut.mutate(sub)}
                          >
                            {isCurrent ? 'Linked' : 'Link'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
