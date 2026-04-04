import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { clientAddonsApi, type AddonCsvImportResult } from '@/api/clientAddons'
import type { Project } from '@/api/clients'

const CSV_TEMPLATE =
  `Code,Description,Notes,Price\r\n` +
  `OPT-001,Web Hosting,Billed monthly in advance,29.99\r\n` +
  `OPT-002,Support,Contact us for details,99.99\r\n`

interface Props {
  clientId: number
  projects: Project[]
  onClose:  () => void
}

export default function ImportAddonsModal({ clientId, projects, onClose }: Props) {
  const qc       = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file,      setFile]      = useState<File | null>(null)
  const [result,    setResult]    = useState<AddonCsvImportResult | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [projectId, setProjectId] = useState<string>('')

  const importMut = useMutation({
    mutationFn: (f: File) => clientAddonsApi.importFromCsv(clientId, Number(projectId), f),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['client-addons', clientId] })

      const parts: string[] = []
      if (data.addonsImported)     parts.push(`${data.addonsImported} added`)
      if (data.addonsUpdated)      parts.push(`${data.addonsUpdated} updated`)
      if (data.assignmentsCreated) parts.push(`${data.assignmentsCreated} assignments created`)
      if (data.assignmentsUpdated) parts.push(`${data.assignmentsUpdated} assignments updated`)
      toast.success(parts.length ? parts.join(', ') + '.' : 'Import complete.')
    },
    onError: () => toast.error('Import failed. Check that the file is a valid CSV.'),
  })

  function handleFile(f: File) { setFile(f); setResult(null) }

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
    a.download = 'options-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setProjectId('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const canImport = !!file && !!projectId && !importMut.isPending

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Options</DialogTitle>
          <DialogDescription>
            Upload a CSV with{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Code</code>,{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Description</code>,{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Notes</code>, and{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Price</code>{' '}
            columns. Select a project to assign all imported options to. If an option code already
            exists, its assignment for the selected project will be updated with the new price.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          {!result ? (
            <>
              {/* Project selector */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Assign to project</p>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                        <span className="ml-2 text-xs text-muted-foreground">({p.status})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File drop zone */}
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
                  <p className="text-sm text-muted-foreground">Drag & drop a CSV file here, or click to select</p>
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
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatChip label="Options added"        value={result.addonsImported}     color="green" />
                <StatChip label="Options updated"      value={result.addonsUpdated}      color="blue"  />
                <StatChip label="Assignments created"  value={result.assignmentsCreated} color="green" />
                <StatChip label="Assignments updated"  value={result.assignmentsUpdated} color="blue"  />
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i} className="bg-red-50 dark:bg-red-950/20">
                          <TableCell className="text-muted-foreground">{err.rowNumber}</TableCell>
                          <TableCell className="font-mono text-sm">{err.code || '—'}</TableCell>
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
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!canImport} onClick={() => file && importMut.mutate(file)}>
                {importMut.isPending ? 'Importing…' : 'Import'}
              </Button>
            </>
          ) : (
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

function StatChip({ label, value, color }: { label: string; value: number; color: 'green' | 'blue' }) {
  const colors = {
    green: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-400',
    blue:  'bg-blue-50  text-blue-800  border-blue-200  dark:bg-blue-950/30  dark:text-blue-400',
  }
  return (
    <div className={`flex flex-col rounded-md border px-3 py-2 ${colors[color]}`}>
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
    </div>
  )
}
