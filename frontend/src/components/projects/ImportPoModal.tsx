import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, FileText, CheckCircle2, AlertCircle, SkipForward, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { purchaseOrderApi, type PoCsvImportResult, type PoCsvConflict } from '@/api/projects'

const CSV_TEMPLATE =
  `OrderNumber,BuildingName,LotName,Amount,Status\r\n` +
  `PO-001,Building A,Lot 101,1500.00,Open\r\n`

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

interface Props {
  projectId: number
  onClose:   () => void
}

export default function ImportPoModal({ projectId, onClose }: Props) {
  const qc       = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file,     setFile]     = useState<File | null>(null)
  const [result,   setResult]   = useState<PoCsvImportResult | null>(null)
  const [dragging, setDragging] = useState(false)

  // Conflict resolution state
  const [conflicts,  setConflicts]  = useState<PoCsvConflict[]>([])
  const [updateSet,  setUpdateSet]  = useState<Set<string>>(new Set())
  const [step,       setStep]       = useState<'upload' | 'conflicts' | 'result'>('upload')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['purchase-orders', projectId] })
    qc.invalidateQueries({ queryKey: ['buildings',       projectId] })
    qc.invalidateQueries({ queryKey: ['project-detail',  projectId] })
  }

  const importMut = useMutation({
    mutationFn: ({ f, overrides }: { f: File; overrides?: string[] }) =>
      purchaseOrderApi.importFromCsv(projectId, f, overrides),
    onSuccess: (data) => {
      if (data.conflicts.length > 0 && !data.conflicts.every(c => updateSet.has(c.orderNumber))) {
        // First pass returned conflicts — show resolution UI
        setConflicts(data.conflicts)
        setUpdateSet(new Set())
        setStep('conflicts')
        // Still invalidate for the rows that were imported
        if (data.importedCount > 0) invalidate()
      } else {
        // Final result
        setResult(data)
        setStep('result')
        invalidate()

        const parts: string[] = []
        if (data.importedCount) parts.push(`${data.importedCount} imported`)
        if (data.updatedCount)  parts.push(`${data.updatedCount} updated`)
        if (data.skippedCount)  parts.push(`${data.skippedCount} skipped`)
        if (data.buildingsCreated) parts.push(`${data.buildingsCreated} building${data.buildingsCreated !== 1 ? 's' : ''} created`)
        if (data.lotsCreated)      parts.push(`${data.lotsCreated} lot${data.lotsCreated !== 1 ? 's' : ''} created`)
        toast.success(parts.length ? parts.join(', ') + '.' : 'Import complete.')
      }
    },
    onError: () => toast.error('Import failed. Check that the file is a valid CSV.'),
  })

  function handleFile(f: File) {
    setFile(f)
    setResult(null)
    setConflicts([])
    setUpdateSet(new Set())
    setStep('upload')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'purchase-orders-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setConflicts([])
    setUpdateSet(new Set())
    setStep('upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  function toggleConflict(orderNumber: string) {
    setUpdateSet(prev => {
      const next = new Set(prev)
      next.has(orderNumber) ? next.delete(orderNumber) : next.add(orderNumber)
      return next
    })
  }

  function selectAll()   { setUpdateSet(new Set(conflicts.map(c => c.orderNumber))) }
  function deselectAll() { setUpdateSet(new Set()) }

  function resolveAndImport() {
    if (!file) return
    importMut.mutate({ f: file, overrides: [...updateSet] })
  }

  const skippedErrors = result?.errors.filter(e => e.reason.toLowerCase().includes('skipped')) ?? []
  const hardErrors    = result?.errors.filter(e => !e.reason.toLowerCase().includes('skipped')) ?? []

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Purchase Orders</DialogTitle>
          {step === 'upload' && (
            <DialogDescription>
              Upload a CSV with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">OrderNumber</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">BuildingName</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">LotName</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">Amount</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">Status</code> (optional).
              Buildings and lots will be created automatically if they don't exist.
            </DialogDescription>
          )}
          {step === 'conflicts' && (
            <DialogDescription>
              {conflicts.length} order number{conflicts.length !== 1 ? 's' : ''} already exist.
              Choose which ones to update with the new data, or keep the current data.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <>
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 transition-colors cursor-pointer
                  ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60'}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Drag & drop a CSV file here, or click to select
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
                </Button>
                <p className="text-xs text-muted-foreground">Max 5 MB</p>
              </div>
            </>
          )}

          {/* ── Conflict resolution step ── */}
          {step === 'conflicts' && (
            <>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Update All</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Keep All</Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {updateSet.size} of {conflicts.length} selected to update
                </span>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Existing Lot</TableHead>
                      <TableHead>Proposed Lot</TableHead>
                      <TableHead className="text-right">Existing Amt</TableHead>
                      <TableHead className="text-right">Proposed Amt</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map(c => {
                      const willUpdate = updateSet.has(c.orderNumber)
                      return (
                        <TableRow key={c.orderNumber} className={willUpdate ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                          <TableCell className="font-mono text-sm font-medium">{c.orderNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.existingLot}</TableCell>
                          <TableCell className="text-sm">{c.proposedLot}</TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">{fmtCurrency(c.existingAmount)}</TableCell>
                          <TableCell className="text-sm text-right">{fmtCurrency(c.proposedAmount)}</TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => toggleConflict(c.orderNumber)}
                              className={`text-xs rounded-full px-3 py-0.5 border font-medium transition-colors ${
                                willUpdate
                                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                              }`}
                            >
                              {willUpdate ? 'Update' : 'Keep'}
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* ── Result step ── */}
          {step === 'result' && result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatChip label="Imported" value={result.importedCount} color="green" icon={<CheckCircle2 className="h-4 w-4" />} />
                <StatChip label="Updated"  value={result.updatedCount}  color="blue"  icon={<RefreshCw    className="h-4 w-4" />} />
                <StatChip label="Skipped"  value={result.skippedCount}  color="yellow" icon={<SkipForward  className="h-4 w-4" />} />
                <StatChip label="Errors"   value={result.errorCount}    color="red"   icon={<AlertCircle  className="h-4 w-4" />} />
                {result.buildingsCreated > 0 && (
                  <StatChip label="Buildings created" value={result.buildingsCreated} color="green" icon={<CheckCircle2 className="h-4 w-4" />} />
                )}
                {result.lotsCreated > 0 && (
                  <StatChip label="Lots created" value={result.lotsCreated} color="green" icon={<CheckCircle2 className="h-4 w-4" />} />
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...hardErrors, ...skippedErrors].map((err, i) => {
                        const isSkipped = err.reason.toLowerCase().includes('skipped')
                        return (
                          <TableRow key={i} className={isSkipped ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-red-50 dark:bg-red-950/20'}>
                            <TableCell className="text-muted-foreground">{err.rowNumber}</TableCell>
                            <TableCell className="font-mono text-sm">{err.orderNumber || '—'}</TableCell>
                            <TableCell className="text-sm">{err.reason}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="pt-2">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={!file || importMut.isPending}
                onClick={() => file && importMut.mutate({ f: file })}
              >
                {importMut.isPending ? 'Importing…' : 'Import'}
              </Button>
            </>
          )}
          {step === 'conflicts' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={resolveAndImport} disabled={importMut.isPending}>
                {importMut.isPending ? 'Applying…' : 'Confirm & Import'}
              </Button>
            </>
          )}
          {step === 'result' && (
            <>
              <Button variant="outline" onClick={reset}>Import another file</Button>
              <Button onClick={onClose}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatChip({
  label, value, color, icon,
}: {
  label: string
  value: number
  color: 'green' | 'yellow' | 'red' | 'blue'
  icon:  React.ReactNode
}) {
  const colors = {
    green:  'bg-green-50  text-green-800  border-green-200  dark:bg-green-950/30  dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400',
    red:    'bg-red-50    text-red-800    border-red-200    dark:bg-red-950/30    dark:text-red-400',
    blue:   'bg-blue-50   text-blue-800   border-blue-200   dark:bg-blue-950/30   dark:text-blue-400',
  }
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${colors[color]}`}>
      {icon}
      <div>
        <p className="text-lg font-semibold leading-none">{value}</p>
        <p className="text-xs opacity-75 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
