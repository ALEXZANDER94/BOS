import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import axios from 'axios'
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
  projectEstimatesApi,
  type QbDocument,
  type QbLine,
  type ConvertEstimateEdits,
} from '@/api/projects'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// Returns "YYYY-MM-DD" for the user's *local* calendar date. toISOString()
// would return UTC, which rolls to the next day west of UTC after 4–8 PM and
// would pre-fill the date inputs with tomorrow's date.
function localIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function todayIso() {
  return localIso(new Date())
}

function plusDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localIso(d)
}

interface Props {
  projectId: number
  estimate:  QbDocument
  onClose:   () => void
}

export default function ConvertEstimateDialog({ projectId, estimate, onClose }: Props) {
  const qc = useQueryClient()

  // Editable copy of the estimate's lines. Item ref (id + name) is preserved
  // verbatim; only qty/rate/description are user-editable.
  const [lines, setLines] = useState<QbLine[]>(() =>
    estimate.lines.map(l => ({ ...l }))
  )
  const [txnDate,      setTxnDate]      = useState<string>(estimate.txnDate || todayIso())
  const [dueDate,      setDueDate]      = useState<string>(estimate.dueDate || plusDaysIso(30))
  const [customerMemo, setCustomerMemo] = useState<string>(estimate.customerMemo ?? '')

  const total = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines])

  function updateLine(idx: number, patch: Partial<QbLine>) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const next = { ...l, ...patch }
      // Recompute amount when qty or rate changes.
      if (patch.qty !== undefined || patch.rate !== undefined) {
        next.amount = +(next.qty * next.rate).toFixed(2)
      }
      return next
    }))
  }

  const convertMut = useMutation({
    mutationFn: () => {
      const edits: ConvertEstimateEdits = {
        txnDate,
        dueDate,
        customerMemo: customerMemo.trim() === '' ? null : customerMemo,
        lines,
      }
      return projectEstimatesApi.convert(projectId, estimate.id, edits)
    },
    onSuccess: invoice => {
      toast.success(
        invoice.docNumber
          ? `Invoice #${invoice.docNumber} created in QuickBooks.`
          : 'Invoice created in QuickBooks.'
      )
      qc.invalidateQueries({ queryKey: ['project-estimates', projectId] })
      qc.invalidateQueries({ queryKey: ['project-invoices',  projectId] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
            ?? err.message
        : 'Conversion failed.'
      toast.error(msg)
    },
  })

  const hasMissingItem = lines.some(l => !l.itemId)
  const submitting     = convertMut.isPending
  const canSubmit      = !hasMissingItem && lines.length > 0 && !submitting

  return (
    <Dialog open onOpenChange={open => { if (!open && !submitting) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Convert Estimate{estimate.docNumber ? ` #${estimate.docNumber}` : ''} to Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source summary */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-0.5">
            <p>
              <span className="text-muted-foreground">Customer:</span>{' '}
              <span className="font-medium">{estimate.customerName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Estimate Total:</span>{' '}
              {fmtCurrency(estimate.totalAmt)}
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="conv-txn-date">Invoice Date</Label>
              <Input
                id="conv-txn-date"
                type="date"
                value={txnDate}
                onChange={e => setTxnDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conv-due-date">Due Date</Label>
              <Input
                id="conv-due-date"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Customer memo */}
          <div className="space-y-1.5">
            <Label htmlFor="conv-memo">Customer Memo (optional)</Label>
            <Textarea
              id="conv-memo"
              rows={2}
              value={customerMemo}
              onChange={e => setCustomerMemo(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Line items */}
          <div className="space-y-1.5">
            <Label>Line Items</Label>
            <div className="rounded-md border overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Item</TableHead>
                    <TableHead className="w-[25%]">Description</TableHead>
                    <TableHead className="w-[12%] text-right">Qty</TableHead>
                    <TableHead className="w-[14%] text-right">Rate</TableHead>
                    <TableHead className="w-[14%] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm whitespace-normal break-words align-top">
                        {line.itemName ?? '—'}
                        {!line.itemId && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-destructive">
                            <AlertCircle className="h-3 w-3" /> missing item ref
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={e => updateLine(idx, { description: e.target.value })}
                          disabled={submitting}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.qty}
                          onChange={e => updateLine(idx, { qty: parseFloat(e.target.value) || 0 })}
                          disabled={submitting}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.rate}
                          onChange={e => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })}
                          disabled={submitting}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtCurrency(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end pr-1 pt-1 text-sm font-medium">
              Total: <span className="ml-2 tabular-nums">{fmtCurrency(total)}</span>
            </div>
          </div>

          {hasMissingItem && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                One or more line items are missing an item reference. QuickBooks requires every
                invoice line to reference an item — open the estimate in QuickBooks and assign
                an item to each line, then try converting again.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => convertMut.mutate()} disabled={!canSubmit}>
            {submitting ? 'Converting…' : 'Convert & Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
