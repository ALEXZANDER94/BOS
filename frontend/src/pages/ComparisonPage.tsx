import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, RefreshCw, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  comparisonApi,
  type ComparisonResult,
  type AdobeHeadersResult,
  type SpreadsheetHeadersResult,
} from '@/api/comparison'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useAdobeSettings } from '@/hooks/useAdobeSettings'
import PdfUploadZone from '@/components/comparison/PdfUploadZone'
import ComparisonTable from '@/components/comparison/ComparisonTable'
import ReportActions from '@/components/comparison/ReportActions'
import { AdobeColumnMappingDialog } from '@/components/comparison/AdobeColumnMappingDialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── State machine ──────────────────────────────────────────────────────────────
// idle → scanning (PDF/Adobe) → mapping → uploading → results
// idle → spreadsheet-scanning (XLSX/CSV) → spreadsheet-mapping → uploading → results
// any step → error
type Phase =
  | 'idle'
  | 'scanning'
  | 'mapping'
  | 'spreadsheet-scanning'
  | 'spreadsheet-mapping'
  | 'uploading'
  | 'results'
  | 'error'

export default function ComparisonPage() {
  const [phase, setPhase]                                       = useState<Phase>('idle')
  const [results, setResults]                                   = useState<ComparisonResult[] | null>(null)
  const [selectedSupplierId, setSelectedSupplierId]             = useState<number | null>(null)
  const [errorMessage, setErrorMessage]                         = useState<string | null>(null)
  const [adobeHeadersResult, setAdobeHeadersResult]             = useState<AdobeHeadersResult | null>(null)
  const [spreadsheetHeadersResult, setSpreadsheetHeadersResult] = useState<SpreadsheetHeadersResult | null>(null)

  // Keep a reference to the dropped file for error-state display context
  const pendingFileRef = useRef<File | null>(null)

  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers()
  const { data: adobeStatus, isLoading: adobeLoading }       = useAdobeSettings()

  // ── PDF Step 1: Convert PDF via Adobe and scan candidate header rows ────────
  const scanHeadersMutation = useMutation({
    mutationFn: (file: File) =>
      comparisonApi.scanAdobeHeaders(selectedSupplierId!, file),
    onSuccess: (data) => {
      setAdobeHeadersResult(data)
      setPhase('mapping')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? 'Adobe conversion failed. Check your internet connection.'
      setErrorMessage(msg)
      setPhase('error')
      toast.error(msg)
    },
  })

  // ── PDF Step 2: Confirm column mapping and run comparison ──────────────────
  const confirmAdobeMutation = useMutation({
    mutationFn: (params: {
      headerRowNumber:  number
      matchColumn:      string
      colPrice:         string
      colDescription:   string | null
      colMfr:           string | null
      colQuantity:      string | null
      colTotal:         string | null
      colInvoiceNumber: string | null
      saveToSupplier:   boolean
    }) =>
      comparisonApi.confirmAdobe({
        sessionToken:     adobeHeadersResult!.sessionToken,
        supplierId:       selectedSupplierId!,
        headerRowNumber:  params.headerRowNumber,
        matchColumn:      params.matchColumn,
        colPrice:         params.colPrice,
        colDescription:   params.colDescription,
        colMfr:           params.colMfr,
        colQuantity:      params.colQuantity,
        colTotal:         params.colTotal,
        colInvoiceNumber: params.colInvoiceNumber,
        saveToSupplier:   params.saveToSupplier,
      }),
    onSuccess: (data) => {
      setResults(data)
      setPhase('results')
      toast.success(`Parsed ${data.length} units via Adobe conversion.`)
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? 'Comparison failed after Adobe conversion.'
      setErrorMessage(msg)
      setPhase('error')
      toast.error(msg)
    },
  })

  // ── Spreadsheet Step 1: Scan XLSX/CSV headers ─────────────────────────────
  const scanSpreadsheetMutation = useMutation({
    mutationFn: (file: File) =>
      comparisonApi.scanSpreadsheetHeaders(selectedSupplierId!, file),
    onSuccess: (data) => {
      setSpreadsheetHeadersResult(data)
      setPhase('spreadsheet-mapping')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? 'Failed to scan spreadsheet headers.'
      setErrorMessage(msg)
      setPhase('error')
      toast.error(msg)
    },
  })

  // ── Spreadsheet Step 2: Confirm mapping and run comparison ────────────────
  const confirmSpreadsheetMutation = useMutation({
    mutationFn: (params: {
      headerRowNumber:  number
      matchColumn:      string
      colPrice:         string
      colDescription:   string | null
      colMfr:           string | null
      colQuantity:      string | null
      colTotal:         string | null
      colInvoiceNumber: string | null
      saveToSupplier:   boolean
    }) =>
      comparisonApi.confirmSpreadsheet({
        sessionToken:     spreadsheetHeadersResult!.sessionToken,
        supplierId:       selectedSupplierId!,
        headerRowNumber:  params.headerRowNumber,
        matchColumn:      params.matchColumn,
        colPrice:         params.colPrice,
        colDescription:   params.colDescription,
        colMfr:           params.colMfr,
        colQuantity:      params.colQuantity,
        colTotal:         params.colTotal,
        colInvoiceNumber: params.colInvoiceNumber,
        saveToSupplier:   params.saveToSupplier,
      }),
    onSuccess: (data) => {
      setResults(data)
      setPhase('results')
      toast.success(`Parsed ${data.length} units from spreadsheet.`)
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? 'Comparison failed.'
      setErrorMessage(msg)
      setPhase('error')
      toast.error(msg)
    },
  })

  // Called by PdfUploadZone when a file is dropped.
  // Branches by extension:
  //   - xlsx/csv → spreadsheet two-step flow (scan headers → mapping dialog → compare)
  //   - pdf      → Adobe two-step flow (requires Adobe to be configured)
  const handleFileDrop = (file: File) => {
    pendingFileRef.current = file
    setErrorMessage(null)
    setAdobeHeadersResult(null)
    setSpreadsheetHeadersResult(null)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'xlsx' || ext === 'csv') {
      setPhase('spreadsheet-scanning')
      scanSpreadsheetMutation.mutate(file)
    } else {
      // PDF path — Adobe PDF Services required
      if (!adobeStatus?.isAvailable) {
        setErrorMessage(
          'Adobe PDF Services is not configured. Go to Settings to connect your account.',
        )
        setPhase('error')
        return
      }
      setPhase('scanning')
      scanHeadersMutation.mutate(file)
    }
  }

  // ── Report mutation ──────────────────────────────────────────────────────────
  const reportMutation = useMutation({
    mutationFn: (includeNewItems: boolean) => comparisonApi.generateReport(results!, includeNewItems),
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `PriceComparison_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded.')
    },
    onError: async (err: { response?: { data?: unknown } }) => {
      // With responseType:'blob', error bodies are blobs — try to read the message.
      let msg = 'Failed to generate report.'
      try {
        if (err.response?.data instanceof Blob) {
          const text = await (err.response.data as Blob).text()
          const json = JSON.parse(text) as { message?: string }
          if (json.message) msg = json.message
        }
      } catch { /* ignore parse errors */ }
      toast.error(msg)
    },
  })

  const handleReset = () => {
    setPhase('idle')
    setResults(null)
    setErrorMessage(null)
    setAdobeHeadersResult(null)
    setSpreadsheetHeadersResult(null)
    pendingFileRef.current = null
    scanHeadersMutation.reset()
    confirmAdobeMutation.reset()
    scanSpreadsheetMutation.reset()
    confirmSpreadsheetMutation.reset()
    // Keep selectedSupplierId so user doesn't have to re-select after reset
  }

  const isUploading =
    phase === 'uploading' ||
    phase === 'scanning' ||
    phase === 'spreadsheet-scanning'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Proposed Price Comparison</h2>
          <p className="text-sm text-muted-foreground">
            Upload a proposed price list to compare against a supplier's master glossary.
          </p>
        </div>
        {phase === 'results' && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            New Comparison
          </Button>
        )}
      </div>

      {/* Supplier selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground shrink-0">Supplier</label>
        {suppliersLoading ? (
          <p className="text-sm text-muted-foreground">Loading suppliers…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No suppliers found. Add a supplier on the Suppliers page first.
          </p>
        ) : (
          <Select
            value={selectedSupplierId?.toString() ?? ''}
            onValueChange={(val) => {
              setSelectedSupplierId(Number(val))
              handleReset()
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a supplier…" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Adobe not configured — informational callout */}
      {!adobeLoading && adobeStatus && !adobeStatus.isAvailable && (phase === 'idle' || phase === 'error') && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
          <Settings className="h-4 w-4 mt-0.5 text-yellow-600 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-400">
              Adobe PDF Services not connected
            </p>
            <p className="text-yellow-700 dark:text-yellow-500 mt-0.5">
              PDF uploads require Adobe PDF Services.{' '}
              <Link to="/settings" className="underline font-medium">
                Go to Settings
              </Link>{' '}
              to configure your account. Excel and CSV files work without Adobe.
            </p>
          </div>
        </div>
      )}

      {/* Upload zone — shown in idle / error phases */}
      {(phase === 'idle' || phase === 'error') && (
        selectedSupplierId ? (
          <>
            <PdfUploadZone
              onUpload={handleFileDrop}
              isUploading={false}
            />
            {phase === 'error' && errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Select a supplier above to begin comparing prices.
            </p>
          </div>
        )
      )}

      {/* Uploading / scanning spinner */}
      {isUploading && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            {phase === 'scanning'
              ? 'Converting PDF via Adobe PDF Services — this may take 15–30 seconds…'
              : phase === 'spreadsheet-scanning'
              ? 'Reading spreadsheet headers…'
              : 'Parsing spreadsheet…'}
          </p>
        </div>
      )}

      {/* Adobe column mapping dialog — shown after PDF scan */}
      {phase === 'mapping' && adobeHeadersResult && (
        <AdobeColumnMappingDialog
          open
          title="Confirm Column Mapping"
          description="Adobe converted your PDF to a spreadsheet. Select the header row and confirm which columns contain each field. Required fields are marked with *."
          result={adobeHeadersResult}
          isConfirming={confirmAdobeMutation.isPending}
          onConfirm={(params) => {
            setPhase('uploading')
            confirmAdobeMutation.mutate(params)
          }}
          onCancel={handleReset}
        />
      )}

      {/* Spreadsheet column mapping dialog — shown after XLSX/CSV header scan */}
      {phase === 'spreadsheet-mapping' && spreadsheetHeadersResult && (
        <AdobeColumnMappingDialog
          open
          title="Confirm Column Mapping"
          description="Confirm which columns in your spreadsheet contain each field. Required fields are marked with *. You can save this mapping as the default for this supplier."
          result={spreadsheetHeadersResult}
          isConfirming={confirmSpreadsheetMutation.isPending}
          onConfirm={(params) => {
            setPhase('uploading')
            confirmSpreadsheetMutation.mutate(params)
          }}
          onCancel={handleReset}
        />
      )}

      {/* Results */}
      {phase === 'results' && results && results.length > 0 && (
        <>
          <ComparisonTable
            results={results}
            supplierId={selectedSupplierId!}
          />
          <ReportActions
            onGenerate={(includeNewItems) => reportMutation.mutate(includeNewItems)}
            isGenerating={reportMutation.isPending}
            resultCount={results.length}
          />
        </>
      )}

      {phase === 'results' && results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No units could be matched or parsed from the file.
        </p>
      )}
    </div>
  )
}
