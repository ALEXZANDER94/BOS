import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { type ColumnMappingResult } from '@/api/comparison'

interface ColumnMappingDialogProps {
  open:        boolean
  title:       string
  description: string
  result:      ColumnMappingResult
  isConfirming: boolean
  onConfirm: (params: {
    headerRowNumber:  number
    matchColumn:      string
    colPrice:         string
    colDescription:   string | null
    colMfr:           string | null
    colQuantity:      string | null
    colTotal:         string | null
    colInvoiceNumber: string | null
    saveToSupplier:   boolean
  }) => void
  onCancel: () => void
}

const NONE = '__none__'

export function AdobeColumnMappingDialog({
  open,
  title,
  description,
  result,
  isConfirming,
  onConfirm,
  onCancel,
}: ColumnMappingDialogProps) {
  const [selectedRowNumber, setSelectedRowNumber] = useState<number>(result.suggestedRowNumber)
  const [matchColumn,      setMatchColumn]        = useState<string>(result.suggestedMatchColumn        ?? '')
  const [colPrice,         setColPrice]           = useState<string>(result.suggestedPriceColumn        ?? '')
  const [colDescription,   setColDescription]     = useState<string>(result.suggestedDescriptionColumn  ?? NONE)
  const [colMfr,           setColMfr]             = useState<string>(result.suggestedMfrColumn           ?? NONE)
  const [colQuantity,      setColQuantity]        = useState<string>(result.suggestedQuantityColumn     ?? NONE)
  const [colTotal,         setColTotal]           = useState<string>(result.suggestedTotalColumn        ?? NONE)
  const [colInvoiceNumber, setColInvoiceNumber]   = useState<string>(result.suggestedInvoiceNumberColumn ?? NONE)
  const [saveToSupplier,   setSaveToSupplier]     = useState(false)

  // The headers available in the currently selected candidate row
  const selectedCandidate = result.candidateRows.find(r => r.rowNumber === selectedRowNumber)
    ?? result.candidateRows[0]
  const availableHeaders = selectedCandidate?.headers ?? []

  // When the user changes the header row, reset column selections
  // (keep if same header name still exists in new row; otherwise reset to NONE/empty)
  useEffect(() => {
    if (!availableHeaders.includes(matchColumn))                                   setMatchColumn('')
    if (!availableHeaders.includes(colPrice))                                      setColPrice('')
    if (colDescription   !== NONE && !availableHeaders.includes(colDescription))   setColDescription(NONE)
    if (colMfr           !== NONE && !availableHeaders.includes(colMfr))           setColMfr(NONE)
    if (colQuantity      !== NONE && !availableHeaders.includes(colQuantity))      setColQuantity(NONE)
    if (colTotal         !== NONE && !availableHeaders.includes(colTotal))         setColTotal(NONE)
    if (colInvoiceNumber !== NONE && !availableHeaders.includes(colInvoiceNumber)) setColInvoiceNumber(NONE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowNumber])

  const canConfirm = matchColumn !== '' && colPrice !== '' && !isConfirming

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm({
      headerRowNumber:  selectedRowNumber,
      matchColumn,
      colPrice,
      colDescription:   colDescription   === NONE ? null : colDescription,
      colMfr:           colMfr           === NONE ? null : colMfr,
      colQuantity:      colQuantity      === NONE ? null : colQuantity,
      colTotal:         colTotal         === NONE ? null : colTotal,
      colInvoiceNumber: colInvoiceNumber === NONE ? null : colInvoiceNumber,
      saveToSupplier,
    })
  }

  /** Format a candidate row for display in the Select */
  function rowLabel(rowNumber: number, headers: string[]) {
    const preview = headers.slice(0, 4).join(', ')
    const more    = headers.length > 4 ? ` +${headers.length - 4} more` : ''
    return `Row ${rowNumber}: ${preview}${more}`
  }

  /** Reusable optional column select (with "— None —" as first option) */
  function OptionalColSelect({
    id, value, onChange,
  }: { id: string; value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="— None —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— None —</SelectItem>
          {availableHeaders.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open && !isConfirming) onCancel() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Header Row selector */}
          <div className="grid gap-1.5">
            <Label htmlFor="header-row">Header Row</Label>
            <Select
              value={String(selectedRowNumber)}
              onValueChange={v => setSelectedRowNumber(Number(v))}
            >
              <SelectTrigger id="header-row">
                <SelectValue placeholder="Select header row…" />
              </SelectTrigger>
              <SelectContent>
                {result.candidateRows.map(row => (
                  <SelectItem key={row.rowNumber} value={String(row.rowNumber)}>
                    {rowLabel(row.rowNumber, row.headers)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Rows with at least two non-empty cells are shown as candidates.
            </p>
          </div>

          {/* Invoice # column — optional */}
          <div className="grid gap-1.5">
            <Label htmlFor="inv-col">Invoice # Column</Label>
            <OptionalColSelect id="inv-col" value={colInvoiceNumber} onChange={setColInvoiceNumber} />
            <p className="text-xs text-muted-foreground">
              Optional — when set, the invoice number is included in results and the PDF report.
            </p>
          </div>

          {/* Match Key column — required */}
          <div className="grid gap-1.5">
            <Label htmlFor="match-col">
              Match Key / Catalog # Column <span className="text-destructive">*</span>
            </Label>
            <Select value={matchColumn} onValueChange={setMatchColumn}>
              <SelectTrigger id="match-col">
                <SelectValue placeholder="Select column…" />
              </SelectTrigger>
              <SelectContent>
                {availableHeaders.map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The column containing the catalog number (and optionally MFR/description if combined).
            </p>
          </div>

          {/* Price column — required */}
          <div className="grid gap-1.5">
            <Label htmlFor="price-col">
              Price Column <span className="text-destructive">*</span>
            </Label>
            <Select value={colPrice} onValueChange={setColPrice}>
              <SelectTrigger id="price-col">
                <SelectValue placeholder="Select column…" />
              </SelectTrigger>
              <SelectContent>
                {availableHeaders.map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description column — optional */}
          <div className="grid gap-1.5">
            <Label htmlFor="desc-col">Description Column</Label>
            <OptionalColSelect id="desc-col" value={colDescription} onChange={setColDescription} />
            <p className="text-xs text-muted-foreground">
              Optional — used to populate the description for new items not in the master glossary.
            </p>
          </div>

          {/* MFR column — optional */}
          <div className="grid gap-1.5">
            <Label htmlFor="mfr-col">Manufacturer (MFR) Column</Label>
            <OptionalColSelect id="mfr-col" value={colMfr} onChange={setColMfr} />
            <p className="text-xs text-muted-foreground">
              Optional — when set, the manufacturer is read directly from this column instead of
              being parsed from the Match Key column via the Format template.
              Useful when the supplier's file has a dedicated MFR column.
            </p>
          </div>

          {/* Quantity column — optional */}
          <div className="grid gap-1.5">
            <Label htmlFor="qty-col">Quantity Column</Label>
            <OptionalColSelect id="qty-col" value={colQuantity} onChange={setColQuantity} />
            <p className="text-xs text-muted-foreground">
              Optional — the number of units on each invoice line. Used together with the Total Column
              to compute the expected total (Master Price × Quantity) for comparison.
            </p>
          </div>

          {/* Total column — optional */}
          <div className="grid gap-1.5">
            <Label htmlFor="total-col">Total Column</Label>
            <OptionalColSelect id="total-col" value={colTotal} onChange={setColTotal} />
            <p className="text-xs text-muted-foreground">
              Optional — the invoice line total. Comparison checks this against Master Price × Quantity.
              When set, differences are total-based rather than per-unit.
            </p>
          </div>

          {/* Save as default checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="save-to-supplier"
              checked={saveToSupplier}
              onCheckedChange={(v: boolean | 'indeterminate') => setSaveToSupplier(v === true)}
            />
            <Label htmlFor="save-to-supplier" className="cursor-pointer font-normal">
              Save as default mapping for this supplier
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isConfirming ? 'Running comparison…' : 'Run Comparison'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
