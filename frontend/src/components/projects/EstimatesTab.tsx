import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Plus, Eye, FileText, Link as LinkIcon,
  Unlink as UnlinkIcon, AlertTriangle, X, FolderTree,
} from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import { Badge } from '@/components/ui/badge'
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
import {
  projectDetailApi,
  projectEstimatesApi,
  projectInvoicesApi,
  projectQbProjectApi,
  quickBooksApi,
  type QbDocument,
} from '@/api/projects'
import ConvertEstimateDialog from '@/components/projects/ConvertEstimateDialog'
import QbProjectPickerDialog from '@/components/projects/QbProjectPickerDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

// QuickBooks returns TxnDate / DueDate as date-only "YYYY-MM-DD" strings.
// new Date("YYYY-MM-DD") parses as UTC midnight, which shifts to the previous
// day when formatted in any timezone west of UTC. Force UTC formatting so the
// calendar date QB stamped is the calendar date we render.
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

function getCustomerMatchError(query: { error: unknown }): string | null {
  const err = query.error
  if (axios.isAxiosError(err) && err.response?.status === 409) {
    const data = err.response.data as { reason?: string; message?: string }
    if (data.reason === 'no-customer-match') return data.message ?? null
  }
  return null
}

// Builds a short descriptor for a QB doc using whatever identifying info is
// available — customer memo first, then a preview of the line items.
// Empty string when nothing useful is available.
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

// ── Main component ────────────────────────────────────────────────────────────

export default function EstimatesTab({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const [linkingType,        setLinkingType]        = useState<'estimate' | 'invoice' | null>(null)
  const [convertingEstimate, setConvertingEstimate] = useState<QbDocument | null>(null)
  const [viewingDoc,         setViewingDoc]         = useState<QbDocument | null>(null)
  const [qbProjectPickerOpen, setQbProjectPickerOpen] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn:  () => projectDetailApi.getById(projectId),
  })

  const { data: qbStatus, isLoading: qbStatusLoading } = useQuery({
    queryKey:  ['qb-status'],
    queryFn:   () => quickBooksApi.getStatus(),
    staleTime: 60_000,
  })
  const qbConnected = qbStatus?.connected ?? false

  const clearQbProjectMut = useMutation({
    mutationFn: () => projectQbProjectApi.set(projectId, null, null),
    onSuccess: () => {
      toast.success('QuickBooks Project link cleared.')
      qc.invalidateQueries({ queryKey: ['project-detail',    projectId] })
      qc.invalidateQueries({ queryKey: ['project-estimates', projectId] })
      qc.invalidateQueries({ queryKey: ['project-invoices',  projectId] })
    },
    onError: () => toast.error('Failed to clear QuickBooks Project link.'),
  })

  const estimatesQuery = useQuery({
    queryKey:  ['project-estimates', projectId],
    queryFn:   () => projectEstimatesApi.getAll(projectId),
    enabled:   qbConnected,
    staleTime: 0,
    retry:     false,
  })

  const invoicesQuery = useQuery({
    queryKey:  ['project-invoices', projectId],
    queryFn:   () => projectInvoicesApi.getAll(projectId),
    enabled:   qbConnected,
    staleTime: 0,
    retry:     false,
  })

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ['project-estimates', projectId] })
    qc.invalidateQueries({ queryKey: ['project-invoices',  projectId] })
  }

  const unlinkEstimateMut = useMutation({
    mutationFn: (qbId: string) => projectEstimatesApi.unlink(projectId, qbId),
    onSuccess:  () => { toast.success('Estimate unlinked.'); refreshAll() },
    onError:    () => toast.error('Failed to unlink estimate.'),
  })

  const unlinkInvoiceMut = useMutation({
    mutationFn: (qbId: string) => projectInvoicesApi.unlink(projectId, qbId),
    onSuccess:  () => { toast.success('Invoice unlinked.'); refreshAll() },
    onError:    () => toast.error('Failed to unlink invoice.'),
  })

  // Early returns ──────────────────────────────────────────────────────────────

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
          project's estimates and invoices.
        </p>
      </div>
    )
  }

  const customerMatchError =
    getCustomerMatchError(estimatesQuery) ?? getCustomerMatchError(invoicesQuery)
  if (customerMatchError) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold mb-1">QuickBooks customer not matched</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{customerMatchError}</p>
      </div>
    )
  }

  // Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* QuickBooks Project (sub-customer) link */}
      <div className="rounded-md border bg-muted/20 px-3 py-2 flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-sm">
          <span className="text-muted-foreground">QuickBooks Project:</span>{' '}
          {project?.qbProjectName ? (
            <>
              <span className="font-medium">{project.qbProjectName}</span>
              {project.qbProjectId && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  (id: {project.qbProjectId})
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground italic">
              not linked — using parent client's customer scope
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setQbProjectPickerOpen(true)}
        >
          <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
          {project?.qbProjectName ? 'Re-link' : 'Link'}
        </Button>
        {project?.qbProjectName && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={clearQbProjectMut.isPending}
            onClick={() => clearQbProjectMut.mutate()}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Clear link — auto-match will retry next visit"
          >
            <UnlinkIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Estimates section */}
      <DocumentSection
        title="Estimates"
        docTypeLabel="Estimate"
        query={estimatesQuery}
        onRefresh={refreshAll}
        onAddLink={() => setLinkingType('estimate')}
        onView={setViewingDoc}
        renderActions={(doc, onUnlink) => (
          <EstimateRowActions
            doc={doc}
            onConvert={() => setConvertingEstimate(doc)}
            onUnlink={() => onUnlink(doc.id)}
          />
        )}
        onUnlink={qbId => unlinkEstimateMut.mutate(qbId)}
      />

      {/* Invoices section */}
      <DocumentSection
        title="Invoices"
        docTypeLabel="Invoice"
        query={invoicesQuery}
        onRefresh={refreshAll}
        onAddLink={() => setLinkingType('invoice')}
        onView={setViewingDoc}
        renderActions={(doc, onUnlink) => (
          <InvoiceRowActions
            doc={doc}
            onUnlink={() => onUnlink(doc.id)}
          />
        )}
        onUnlink={qbId => unlinkInvoiceMut.mutate(qbId)}
      />

      {linkingType && (
        <LinkDocDialog
          type={linkingType}
          projectId={projectId}
          available={
            (linkingType === 'estimate' ? estimatesQuery.data : invoicesQuery.data)?.available ?? []
          }
          onClose={() => setLinkingType(null)}
        />
      )}

      {convertingEstimate && (
        <ConvertEstimateDialog
          projectId={projectId}
          estimate={convertingEstimate}
          onClose={() => setConvertingEstimate(null)}
        />
      )}

      {viewingDoc && (
        <ViewDocDialog
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {qbProjectPickerOpen && (
        <QbProjectPickerDialog
          projectId={projectId}
          currentQbProjectId={project?.qbProjectId ?? null}
          onClose={() => setQbProjectPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Section: Estimates or Invoices table ──────────────────────────────────────

interface DocumentSectionProps {
  title:         string
  docTypeLabel:  'Estimate' | 'Invoice'
  query:         ReturnType<typeof useQuery<{ linked: QbDocument[]; available: QbDocument[] }>>
  onRefresh:     () => void
  onAddLink:     () => void
  onView:        (doc: QbDocument) => void
  renderActions: (doc: QbDocument, onUnlink: (qbId: string) => void) => React.ReactNode
  onUnlink:      (qbId: string) => void
}

function DocumentSection({
  title, docTypeLabel, query, onRefresh, onAddLink, onView, renderActions, onUnlink,
}: DocumentSectionProps) {
  const linked = query.data?.linked ?? []
  const isInvoice = docTypeLabel === 'Invoice'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          {linked.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {linked.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={query.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onAddLink}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Link {docTypeLabel} from QB
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
          Loading from QuickBooks…
        </div>
      ) : linked.length === 0 ? (
        <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} linked to this project yet.
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
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linked.map(doc => {
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
                    <TableCell className="text-xs text-muted-foreground align-top max-w-[260px]">
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
                      <SourceBadge source={doc.linkSource} />
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(doc)}
                          title="View line items"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {renderActions(doc, onUnlink)}
                      </div>
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

// ── Row actions ───────────────────────────────────────────────────────────────

function EstimateRowActions({
  doc, onConvert, onUnlink,
}: { doc: QbDocument; onConvert: () => void; onUnlink: () => void }) {
  const alreadyConverted = !!doc.linkedInvoiceId
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onConvert}
        disabled={alreadyConverted}
        title={alreadyConverted ? 'Already converted in QuickBooks' : 'Convert to invoice'}
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>
      {doc.linkSource === 'explicit' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnlink}
          title="Unlink from this project"
        >
          <UnlinkIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  )
}

function InvoiceRowActions({
  doc, onUnlink,
}: { doc: QbDocument; onUnlink: () => void }) {
  if (doc.linkSource !== 'explicit') return null
  return (
    <Button variant="ghost" size="sm" onClick={onUnlink} title="Unlink from this project">
      <UnlinkIcon className="h-3.5 w-3.5" />
    </Button>
  )
}

// ── Status / source badges ────────────────────────────────────────────────────

function StatusBadge({ docType, status }: { docType: string; status: string }) {
  const colors = docType === 'Estimate' ? ESTIMATE_STATUS_COLORS : INVOICE_STATUS_COLORS
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[status] ?? ''}`}>
      {status}
    </Badge>
  )
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'custom-field') {
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
        title="Auto-linked via QuickBooks custom field"
      >
        Auto
      </Badge>
    )
  }
  if (source === 'explicit') {
    return (
      <Badge variant="outline" className="text-[10px]" title="Manually linked">
        Linked
      </Badge>
    )
  }
  return null
}

// ── Link dialog (pick from "available" list) ──────────────────────────────────

interface LinkDocDialogProps {
  type:      'estimate' | 'invoice'
  projectId: number
  available: QbDocument[]
  onClose:   () => void
}

function LinkDocDialog({ type, projectId, available, onClose }: LinkDocDialogProps) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return available
    return available.filter(d =>
      (d.docNumber ?? '').toLowerCase().includes(s)
      || d.customerName.toLowerCase().includes(s)
      || (d.customerParentName ?? '').toLowerCase().includes(s)
      || (d.customerMemo ?? '').toLowerCase().includes(s)
      || d.lines.some(l =>
            (l.description ?? '').toLowerCase().includes(s)
            || (l.itemName ?? '').toLowerCase().includes(s))
    )
  }, [available, search])

  const linkMut = useMutation({
    mutationFn: (qbId: string) =>
      type === 'estimate'
        ? projectEstimatesApi.link(projectId, qbId)
        : projectInvoicesApi.link(projectId, qbId),
    onSuccess: () => {
      toast.success(`${type === 'estimate' ? 'Estimate' : 'Invoice'} linked.`)
      qc.invalidateQueries({ queryKey: [`project-${type}s`, projectId] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Link failed.'
        : 'Link failed.'
      toast.error(msg)
    },
  })

  const isInvoice = type === 'invoice'

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Link {isInvoice ? 'Invoice' : 'Estimate'} from QuickBooks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder={`Search by # or memo…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
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

          {filtered.length === 0 ? (
            <div className="rounded-md border py-6 text-center text-sm text-muted-foreground">
              {available.length === 0
                ? `No unlinked ${type}s available for this customer.`
                : 'No matches.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-y-auto max-h-[60vh]">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10%]">#</TableHead>
                    <TableHead className="w-[14%]">Date</TableHead>
                    <TableHead className="w-[42%]">Description</TableHead>
                    <TableHead className="w-[12%] text-right">Total</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[10%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(doc => {
                    const summary = summarizeDoc(doc)
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium align-top whitespace-normal break-words">
                          {doc.docNumber ?? <span className="text-muted-foreground">—</span>}
                          {doc.customerParentName && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {doc.customerParentName} → {doc.customerName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm align-top">{fmtDate(doc.txnDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top whitespace-normal break-words">
                          {summary
                            ? <span title={summary}>{summary}</span>
                            : <span className="italic">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums align-top">
                          {fmtCurrency(doc.totalAmt)}
                        </TableCell>
                        <TableCell className="align-top">
                          <StatusBadge docType={doc.docType} status={doc.status} />
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => linkMut.mutate(doc.id)}
                            disabled={linkMut.isPending}
                          >
                            <LinkIcon className="h-3 w-3 mr-1" /> Link
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

// ── View dialog (read-only line items) ────────────────────────────────────────

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
              <p>{doc.customerName}</p>
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
