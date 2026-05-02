import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Download, Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import axios from 'axios'

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
        <p className="text-sm text-muted-foreground">Utility tools for file conversion and processing.</p>
      </div>

      <IifToPdfTool />
    </div>
  )
}

interface IifSection {
  name: string
  headers: string[]
  rows: string[][]
}

interface ParseResult {
  isValid: boolean
  warnings: string[]
  sections: IifSection[]
}

function IifToPdfTool() {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [converting, setConverting] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [trimEmpty, setTrimEmpty] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setParseResult(null)
    setResultUrl(null)
    setResultName('')
  }

  const handleFileSelected = useCallback(async (f: File, trim = trimEmpty) => {
    setFile(f)
    setParseResult(null)
    setResultUrl(null)

    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await axios.post<ParseResult>(`/api/tools/iif-parse?trimEmpty=${trim}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setParseResult(res.data)
      if (!res.data.isValid) {
        toast.error('File appears malformed — see warnings below')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to parse file'
      toast.error(typeof msg === 'string' ? msg : 'Failed to parse file')
      setFile(null)
    } finally {
      setParsing(false)
    }
  }, [trimEmpty])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFileSelected(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.iif')) {
      toast.error('Only .iif files are accepted')
      return
    }
    handleFileSelected(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleConvert() {
    if (!file) return
    setConverting(true)
    setResultUrl(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await axios.post(`/api/tools/iif-to-pdf?trimEmpty=${trimEmpty}`, fd, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      setResultName(file.name.replace(/\.iif$/i, '.pdf'))
      toast.success('Conversion complete')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Conversion failed'
      toast.error(typeof msg === 'string' ? msg : 'Conversion failed')
    } finally {
      setConverting(false)
    }
  }

  function handleDownload() {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = resultName
    a.click()
  }

  return (
    <div className="rounded-lg border p-6 space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> IIF to PDF Converter
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a QuickBooks Interchange Format (.iif) file to preview its content and convert it to a formatted PDF.
        </p>
      </div>

      {/* Dropzone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
            ${dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
          `}
        >
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Drag & drop a <span className="font-medium">.iif</span> file here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground/60">Max 10 MB</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".iif" hidden onChange={handleInputChange} />

      {/* File selected state */}
      {file && !resultUrl && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{file.name}</span>
            <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reset}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Parsing spinner */}
      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Parsing file…
        </div>
      )}

      {/* Parse result — warnings */}
      {parseResult && parseResult.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            {parseResult.isValid ? 'Warnings' : 'File appears malformed'}
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 ml-5 list-disc">
            {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          {!parseResult.isValid && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              This file cannot be converted. Please notify the sender that the file format is invalid.
            </p>
          )}
        </div>
      )}

      {/* Parse result — preview table */}
      {parseResult && parseResult.isValid && parseResult.sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-1.5 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {parseResult.sections.length} section{parseResult.sections.length !== 1 ? 's' : ''} parsed successfully
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trimEmpty}
                  onChange={(e) => {
                    setTrimEmpty(e.target.checked)
                    if (file) handleFileSelected(file, e.target.checked)
                  }}
                  className="rounded border-muted-foreground/30"
                />
                Trim empty columns
              </label>
              <Button size="sm" onClick={handleConvert} disabled={converting}>
                {converting ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Converting…</>
                ) : (
                  'Convert to PDF'
                )}
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border">
            {parseResult.sections.map((section, si) => (
              <div key={si} className={si > 0 ? 'border-t' : ''}>
                <div className="sticky top-0 bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {section.name}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    {section.headers.length > 0 && (
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {section.headers.map((h, hi) => (
                            <th key={hi} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {section.rows.slice(0, 10).map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {section.rows.length > 10 && (
                        <tr>
                          <td colSpan={section.headers.length || 1} className="px-2 py-1 text-muted-foreground italic">
                            … and {section.rows.length - 10} more row{section.rows.length - 10 !== 1 ? 's' : ''}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download result */}
      {resultUrl && (
        <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/20 p-3">
          <FileText className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">{resultName}</p>
            <p className="text-xs text-green-600 dark:text-green-400">Ready for download</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Convert Another
          </Button>
        </div>
      )}
    </div>
  )
}
