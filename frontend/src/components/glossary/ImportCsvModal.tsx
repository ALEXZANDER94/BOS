import { useRef, useState } from 'react'
import { Upload, Download, FileText, CheckCircle2, AlertCircle, SkipForward, RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useImportGlossary } from '@/hooks/useGlossary'
import type { CsvImportResultDto } from '@/api/glossary'

interface Props {
  supplierId: number
  open: boolean
  onClose: () => void
}

// The CSV template content — always matches the required columns.
// Generated entirely client-side; no backend call needed.
const CSV_TEMPLATE =
  'CatalogNumber,Description,MFR,ContractedPrice\r\n' +
  'CAT-001,Example Widget,Acme Industries,12.50\r\n'

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'glossary-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportCsvModal({ supplierId, open, onClose }: Props) {
  const fileInputRef                              = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile]           = useState<File | null>(null)
  const [result, setResult]                       = useState<CsvImportResultDto | null>(null)
  const [dragOver, setDragOver]                   = useState(false)
  const [overwrite, setOverwrite]                 = useState(false)
  const { mutate: importCsv, isPending }          = useImportGlossary(supplierId)

  // ---------- helpers ----------

  function reset() {
    setSelectedFile(null)
    setResult(null)
    setOverwrite(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(file: File | null) {
    if (!file) return
    setSelectedFile(file)
    setResult(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0] ?? null
    handleFileChange(file)
  }

  function handleSubmit() {
    if (!selectedFile) return
    importCsv({ file: selectedFile, overwrite }, {
      onSuccess: (data) => setResult(data),
    })
  }

  // ---------- render ----------

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Units from CSV</DialogTitle>
          <DialogDescription>
            {overwrite
              ? 'Existing catalog numbers will be updated with values from the file. New catalog numbers will be added.'
              : 'New catalog numbers will be added. Existing catalog numbers will be skipped.'}
          </DialogDescription>
          <DialogDescription>
            <strong>Column Names:</strong>
            <br />
            <em>CatalogNumber</em>, <em>Description</em>, <em>MFR</em>, <em>ContractedPrice</em>
          </DialogDescription>
        </DialogHeader>

        {/* ── View A: file picker ── */}
        {result === null && (
          <div className="space-y-4 pt-1">
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              className={[
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <>
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Click or drag a .csv file here</p>
                  <p className="text-xs text-muted-foreground">Max 5 MB</p>
                </>
              )}
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            {/* Overwrite toggle */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="overwrite-toggle" className="text-sm font-medium cursor-pointer">
                  Update existing units
                </Label>
                <p className="text-xs text-muted-foreground">
                  When on, matching catalog numbers will be overwritten
                </p>
              </div>
              <Switch
                id="overwrite-toggle"
                checked={overwrite}
                onCheckedChange={setOverwrite}
              />
            </div>

            {/* Template download + actions */}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
                onClick={downloadTemplate}
              >
                <Download className="h-3.5 w-3.5" />
                Download template
              </Button>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedFile || isPending}
                >
                  {isPending ? 'Importing…' : 'Import'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── View B: results summary ── */}
        {result !== null && (
          <div className="space-y-4 pt-1">
            {/* Stat chips */}
            <div className="grid grid-cols-4 gap-3">
              <StatChip
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Imported"
                value={result.importedCount}
                color="green"
              />
              <StatChip
                icon={<Pencil className="h-4 w-4" />}
                label="Updated"
                value={result.updatedCount}
                color="blue"
              />
              <StatChip
                icon={<SkipForward className="h-4 w-4" />}
                label="Skipped"
                value={result.skippedCount}
                color="yellow"
              />
              <StatChip
                icon={<AlertCircle className="h-4 w-4" />}
                label="Errors"
                value={result.errorCount}
                color="red"
              />
            </div>

            {/* Per-row error table */}
            {result.errors.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead className="w-32">Catalog #</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow
                          key={i}
                          className={
                            err.reason.includes('skipped')
                              ? 'bg-yellow-50'
                              : 'bg-red-50'
                          }
                        >
                          <TableCell className="text-muted-foreground text-xs">
                            {err.rowNumber}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {err.catalogNumber || '—'}
                          </TableCell>
                          <TableCell className="text-xs">{err.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Import another file
              </Button>
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------- small presentational sub-component ----------

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: number
  color: 'green' | 'blue' | 'yellow' | 'red'
}

const colorMap = {
  green:  'bg-green-50  text-green-700  border-green-200',
  blue:   'bg-blue-50   text-blue-700   border-blue-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red:    'bg-red-50    text-red-700    border-red-200',
}

function StatChip({ icon, label, value, color }: StatChipProps) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xl font-semibold">{value}</span>
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
