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
import { quickBooksApi } from '@/api/projects'
import { clientApi } from '@/api/clients'

interface Props {
  clientId:           number
  currentCustomerId:  string | null
  onClose:            () => void
}

export default function QbCustomerPickerDialog({ clientId, currentCustomerId, onClose }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['qb-customers'],
    queryFn:  () => quickBooksApi.listCustomers(),
    staleTime: 60_000,
    retry:    false,
  })

  const filtered = useMemo(() => {
    const list = customers ?? []
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter(c => c.displayName.toLowerCase().includes(s))
  }, [customers, search])

  const selectMut = useMutation({
    mutationFn: (c: { id: string; displayName: string }) =>
      clientApi.setQbCustomer(clientId, c.id, c.displayName),
    onSuccess: () => {
      toast.success('QuickBooks customer linked.')
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['project-estimates'] })
      qc.invalidateQueries({ queryKey: ['project-invoices'] })
      onClose()
    },
    onError: () => toast.error('Failed to link QuickBooks customer.'),
  })

  const fetchError = error
    ? axios.isAxiosError(error)
      ? (error.response?.data as { message?: string } | undefined)?.message
          ?? 'Failed to load QuickBooks customers.'
      : 'Failed to load QuickBooks customers.'
    : null

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Link to QuickBooks Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search customers…"
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
              {customers && customers.length === 0
                ? 'No customers in QuickBooks yet.'
                : 'No matches.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden max-h-[55vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const isCurrent = c.id === currentCustomerId
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">
                          {c.displayName}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] text-muted-foreground">(current)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isCurrent ? 'ghost' : 'outline'}
                            disabled={isCurrent || selectMut.isPending}
                            onClick={() => selectMut.mutate(c)}
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
