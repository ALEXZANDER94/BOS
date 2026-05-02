import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Eye, AlertTriangle, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { clientQbDocumentsApi } from '@/api/clients'
import { quickBooksApi, type QbDocument } from '@/api/projects'

// ── Helpers ───────────────────────────────────────────────────────────────────

// QB date-only fields ("YYYY-MM-DD") parsed via new Date() are UTC-midnight,
// which shift backwards in any timezone west of UTC. Force UTC formatting so
// the calendar date QB stamped is the calendar date we render.
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function summarizeDoc(doc: QbDocument): string {
  if (doc.customerMemo && doc.customerMemo.trim().length > 0)
    return doc.customerMemo.trim()
  if (doc.lines.length === 0) return ''
  const first = doc.lines[0]
  const head  = first.description?.trim() || first.itemName?.trim() || ''
  if (doc.lines.length === 1) return head
  return `${head} · +${doc.lines.length - 1} more line${doc.lines.length - 1 > 1 ? 's' : ''}`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const ESTIMATE_STATUS_COLORS: Record<string, string> = {
  Pending:  'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Accepted: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400',
  Closed:   'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Rejected: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400',
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Paid:    'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Unpaid:  'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400',
}

const ESTIMATE_STATUSES = ['Pending', 'Accepted', 'Closed', 'Rejected'] as const
const INVOICE_STATUSES  = ['Paid', 'Unpaid', 'Overdue']                 as const

function StatusBadge({ docType, status }: { docType: string; status: string }) {
  const colors = docType === 'Estimate' ? ESTIMATE_STATUS_COLORS : INVOICE_STATUS_COLORS
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[status] ?? ''}`}>
      {status}
    </Badge>
  )
}

function getCustomerMatchError(query: { error: unknown }): string | null {
  const err = query.error
  if (axios.isAxiosError(err) && err.response?.status === 409) {
    const data = err.response.data as { reason?: string; message?: string }
    if (data.reason === 'no-customer-match') return data.message ?? null
  }
  return null
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ClientQbDocumentsPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const [viewingDoc, setViewingDoc] = useState<QbDocument | null>(null)
  const [estimateStatusFilter, setEstimateStatusFilter] = useState<string[]>(['Pending'])
  const [invoiceStatusFilter,  setInvoiceStatusFilter]  = useState<string[]>(['Unpaid', 'Overdue'])

  function toggleStatus(current: string[], status: string): string[] {
    return current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
  }

  const { data: qbStatus, isLoading: qbStatusLoading } = useQuery({
    queryKey:  ['qb-status'],
    queryFn:   () => quickBooksApi.getStatus(),
    staleTime: 60_000,
  })
  const qbConnected = qbStatus?.connected ?? false

  const docsQuery = useQuery({
    queryKey:  ['client-qb-documents', clientId],
    queryFn:   () => clientQbDocumentsApi.getAll(clientId),
    enabled:   qbConnected,
    staleTime: 0,
    retry:     false,
  })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['client-qb-documents', clientId] })
  }

  // Empty / error states ───────────────────────────────────────────────────────

  if (qbStatusLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!qbConnected) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center">
        <h3 className="text-sm font-semibold mb-1">QuickBooks is not connected</h3>
        <p className="text-sm text-muted-foreground">
          Connect QuickBooks in <span className="font-medium">Settings</span> to view this
          client's estimates and invoices.
        </p>
      </div>
    )
  }

  const customerMatchError = getCustomerMatchError(docsQuery)
  if (customerMatchError) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold mb-1">QuickBooks customer not matched</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{customerMatchError}</p>
      </div>
    )
  }

  const estimates = docsQuery.data?.estimates ?? []
  const invoices  = docsQuery.data?.invoices  ?? []

  const filteredEstimates = estimates.filter(d => estimateStatusFilter.includes(d.status))
  const filteredInvoices  = invoices.filter(d => invoiceStatusFilter.includes(d.status))

  return (
    <div className="space-y-8">
      {/* Top-of-panel refresh control */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={docsQuery.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${docsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <DocumentSection
        title="Estimates"
        docTypeLabel="Estimate"
        docs={filteredEstimates}
        totalCount={estimates.length}
        isLoading={docsQuery.isLoading}
        onView={setViewingDoc}
        statusOptions={ESTIMATE_STATUSES}
        selectedStatuses={estimateStatusFilter}
        onToggleStatus={s => setEstimateStatusFilter(prev => toggleStatus(prev, s))}
      />

      <DocumentSection
        title="Invoices"
        docTypeLabel="Invoice"
        docs={filteredInvoices}
        totalCount={invoices.length}
        isLoading={docsQuery.isLoading}
        onView={setViewingDoc}
        statusOptions={INVOICE_STATUSES}
        selectedStatuses={invoiceStatusFilter}
        onToggleStatus={s => setInvoiceStatusFilter(prev => toggleStatus(prev, s))}
      />

      {viewingDoc && (
        <ViewDocDialog
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  )
}

// ── Estimates / Invoices section ──────────────────────────────────────────────

interface DocumentSectionProps {
  title:            string
  docTypeLabel:     'Estimate' | 'Invoice'
  docs:             QbDocument[]
  totalCount:       number
  isLoading:        boolean
  onView:           (doc: QbDocument) => void
  statusOptions:    readonly string[]
  selectedStatuses: string[]
  onToggleStatus:   (status: string) => void
}

function DocumentSection({
  title, docTypeLabel, docs, totalCount, isLoading, onView,
  statusOptions, selectedStatuses, onToggleStatus,
}: DocumentSectionProps) {
  const isInvoice = docTypeLabel === 'Invoice'
  const colors    = isInvoice ? INVOICE_STATUS_COLORS : ESTIMATE_STATUS_COLORS
  const filtered  = totalCount !== docs.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          {totalCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {filtered ? `${docs.length} / ${totalCount}` : docs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusOptions.map(status => {
            const active = selectedStatuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => onToggleStatus(status)}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
                  active
                    ? colors[status] ?? 'bg-muted'
                    : 'bg-background text-muted-foreground border-muted hover:bg-muted/50'
                }`}
                aria-pressed={active}
              >
                {status}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
          Loading from QuickBooks…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
          {totalCount === 0
            ? `No ${title.toLowerCase()} found for this client in QuickBooks.`
            : selectedStatuses.length === 0
              ? `No status selected — pick one or more above to view ${title.toLowerCase()}.`
              : `No ${title.toLowerCase()} match the selected status${selectedStatuses.length > 1 ? 'es' : ''}.`}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Date</TableHead>
                {isInvoice && <TableHead>Due</TableHead>}
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {isInvoice && <TableHead className="text-right">Balance</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>BOS Project</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(doc => {
                const summary = summarizeDoc(doc)
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium align-top">
                      {doc.docNumber ?? <span className="text-muted-foreground">—</span>}
                      {doc.linkedFromEstimateId && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          From Estimate
                        </Badge>
                      )}
                      {doc.customerParentName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {doc.customerParentName} → {doc.customerName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm align-top">{fmtDate(doc.txnDate)}</TableCell>
                    {isInvoice && (
                      <TableCell className="text-sm align-top">{fmtDate(doc.dueDate)}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground align-top max-w-[280px]">
                      {summary
                        ? <span title={summary}>{truncate(summary, 80)}</span>
                        : <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top">{fmtCurrency(doc.totalAmt)}</TableCell>
                    {isInvoice && (
                      <TableCell className="text-right tabular-nums align-top">{fmtCurrency(doc.balance)}</TableCell>
                    )}
                    <TableCell className="align-top">
                      <StatusBadge docType={doc.docType} status={doc.status} />
                    </TableCell>
                    <TableCell className="align-top">
                      {doc.bosProjectId ? (
                        <Link
                          to={`/projects/${doc.bosProjectId}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {doc.bosProjectName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(doc)}
                        title="View line items"
                      >
                        <Eye className="h-3.5 w-3.5" />
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
  )
}

// ── View dialog ───────────────────────────────────────────────────────────────

function ViewDocDialog({ doc, onClose }: { doc: QbDocument; onClose: () => void }) {
  const visibleCustomFields = doc.customFields.filter(f => f.value && f.value.trim() !== '')

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {doc.docType} {doc.docNumber ? `#${doc.docNumber}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</p>
              <p>
                {doc.customerName}
                {doc.customerParentName && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    (under {doc.customerParentName})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
              <StatusBadge docType={doc.docType} status={doc.status} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p>
              <p>{fmtDate(doc.txnDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {doc.docType === 'Invoice' ? 'Due Date' : 'Expiration'}
              </p>
              <p>{fmtDate(doc.dueDate)}</p>
            </div>
            {doc.bosProjectId && (
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BOS Project</p>
                <Link
                  to={`/projects/${doc.bosProjectId}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {doc.bosProjectName}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          {visibleCustomFields.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Custom Fields
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm rounded-md border bg-muted/20 p-3">
                {visibleCustomFields.map((f, idx) => (
                  <div key={idx}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.name}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {doc.customerMemo && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                Customer Memo
              </p>
              <p className="text-sm whitespace-pre-wrap">{doc.customerMemo}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Line Items
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[22%]">Item</TableHead>
                    <TableHead className="w-[48%]">Description</TableHead>
                    <TableHead className="w-[10%] text-right">Qty</TableHead>
                    <TableHead className="w-[10%] text-right">Rate</TableHead>
                    <TableHead className="w-[10%] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm whitespace-normal break-words align-top">{line.itemName ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-normal break-words align-top">{line.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums align-top">{line.qty}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums align-top">{fmtCurrency(line.rate)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums align-top">{fmtCurrency(line.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="font-medium">Total</span>
            <span className="font-medium tabular-nums">{fmtCurrency(doc.totalAmt)}</span>
          </div>
          {doc.docType === 'Invoice' && (
            <div className="flex justify-between text-sm">
              <span className="font-medium">Balance</span>
              <span className="font-medium tabular-nums">{fmtCurrency(doc.balance)}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
