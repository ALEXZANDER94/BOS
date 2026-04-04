import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
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
import { buildingLotImportApi, type BuildingLotCsvImportResult } from '@/api/projects'

const CSV_TEMPLATE =
  `BuildingName,LotName,LotDescription,AddressNumber,AddressStreet,City,State,Zip,Country\r\n` +
  `Building A,Lot 101,,123,Main St,Springfield,IL,62701,US\r\n` +
  `Building A,Lot 102,Corner unit,456,Oak Ave,Springfield,IL,62702,US\r\n` +
  `Building B,Lot 201,,,,,,,\r\n`

interface Props {
  projectId: number
  onClose:   () => void
}

type Step = 'upload' | 'result'

export default function ImportBuildingsModal({ projectId, onClose }: Props) {
  const qc       = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file,     setFile]     = useState<File | null>(null)
  const [result,   setResult]   = useState<BuildingLotCsvImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const [step,     setStep]     = useState<Step>('upload')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['buildings',      projectId] })
    qc.invalidateQueries({ queryKey: ['project-detail', projectId] })
  }

  const importMut = useMutation({
    mutationFn: (f: File) => buildingLotImportApi.importFromCsv(projectId, f),
    onSuccess: (data) => {
      setResult(data)
      setStep('result')
      invalidate()

      const parts: string[] = []
      if (data.buildingsCreated) parts.push(`${data.buildingsCreated} building${data.buildingsCreated !== 1 ? 's' : ''} created`)
      if (data.lotsCreated)      parts.push(`${data.lotsCreated} lot${data.lotsCreated !== 1 ? 's' : ''} created`)
      if (data.addressesSet)     parts.push(`${data.addressesSet} address${data.addressesSet !== 1 ? 'es' : ''} set`)
      toast.success(parts.length ? parts.join(', ') + '.' : 'Import complete.')
    },
    onError: () => toast.error('Import failed. Check that the file is a valid CSV.'),
  })

  function handleFile(f: File) {
    setFile(f)
    setResult(null)
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
    a.download = 'buildings-lots-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setStep('upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Buildings &amp; Lots</DialogTitle>
          {step === 'upload' && (
            <DialogDescription>
              Upload a CSV with columns:{' '}
              {['BuildingName', 'LotName', 'LotDescription', 'AddressNumber', 'AddressStreet', 'City', 'State', 'Zip', 'Country'].map(col => (
                <code key={col} className="text-xs bg-muted px-1 py-0.5 rounded mx-0.5">{col}</code>
              ))}.
              Buildings and lots will be created if they don't exist. Address fields are optional.
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
                    Drag &amp; drop a CSV file here, or click to select
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

              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Address format</p>
                <p>
                  <code className="bg-muted px-1 rounded">AddressNumber</code> and{' '}
                  <code className="bg-muted px-1 rounded">AddressStreet</code> are combined into a single address line.
                  For example, <code className="bg-muted px-1 rounded">123</code> +{' '}
                  <code className="bg-muted px-1 rounded">Main St</code> → <code className="bg-muted px-1 rounded">123 Main St</code>.
                  Leave both blank to import without an address.
                </p>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
                </Button>
                <p className="text-xs text-muted-foreground">Max 5 MB</p>
              </div>
            </>
          )}

          {/* ── Result step ── */}
          {step === 'result' && result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatChip
                  label="Buildings created"
                  value={result.buildingsCreated}
                  color="green"
                  icon={<Building2 className="h-4 w-4" />}
                />
                <StatChip
                  label="Buildings existing"
                  value={result.buildingsExisting}
                  color="blue"
                  icon={<Building2 className="h-4 w-4" />}
                />
                <StatChip
                  label="Lots created"
                  value={result.lotsCreated}
                  color="green"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <StatChip
                  label="Lots existing"
                  value={result.lotsExisting}
                  color="blue"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                {result.addressesSet > 0 && (
                  <StatChip
                    label="Addresses set"
                    value={result.addressesSet}
                    color="green"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  />
                )}
                {result.errorCount > 0 && (
                  <StatChip
                    label="Errors"
                    value={result.errorCount}
                    color="red"
                    icon={<AlertCircle className="h-4 w-4" />}
                  />
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i} className="bg-red-50 dark:bg-red-950/20">
                          <TableCell className="text-muted-foreground">{err.rowNumber}</TableCell>
                          <TableCell className="text-sm">{err.buildingName || '—'}</TableCell>
                          <TableCell className="text-sm">{err.lotName || '—'}</TableCell>
                          <TableCell className="text-sm">{err.reason}</TableCell>
                        </TableRow>
                      ))}
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
                onClick={() => file && importMut.mutate(file)}
              >
                {importMut.isPending ? 'Importing…' : 'Import'}
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
  color: 'green' | 'blue' | 'red'
  icon:  React.ReactNode
}) {
  const colors = {
    green: 'bg-green-50  text-green-800  border-green-200  dark:bg-green-950/30  dark:text-green-400',
    blue:  'bg-blue-50   text-blue-800   border-blue-200   dark:bg-blue-950/30   dark:text-blue-400',
    red:   'bg-red-50    text-red-800    border-red-200    dark:bg-red-950/30    dark:text-red-400',
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
