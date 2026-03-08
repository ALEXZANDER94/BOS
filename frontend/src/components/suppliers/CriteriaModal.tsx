import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { criteriaSchema, type CriteriaFormValues } from './criteriaSchema'
import { useUpsertCriteria } from '@/hooks/useSuppliers'
import type { Supplier } from '@/api/suppliers'

// ── Live format preview ───────────────────────────────────────────────────────

// A few hardcoded sample cells to demonstrate the format template.
const SAMPLE_CELLS: Record<string, string> = {
  platt:   'SQUARE EZM METERING BUS\nEZM3EXT',
  ced:     'SQUARE\nEZM3EXT',
  generic: 'ACME Widget Pro 500mA\nWP-500MA-ACME',
}

/**
 * Naive client-side preview of the format template.
 * Mirrors CriteriaParser.Parse logic (simplified) — just good enough for UX feedback.
 */
function previewParse(format: string, sampleCell: string): { mfr: string; description: string; catalogNumber: string } | null {
  if (!format || !sampleCell) return null

  const formatLines = format.split('\\n')
  const cellLines   = sampleCell.split('\n')

  let catalogNumber = ''
  let mfr           = ''
  let description   = ''

  const pairCount = Math.min(formatLines.length, cellLines.length)

  for (let i = 0; i < pairCount; i++) {
    const fLine = formatLines[i].trim()
    const cLine = cellLines[i].trim()

    if (!fLine || !cLine) continue

    const tokens: Array<{ token: string; index: number }> = []
    for (const tok of ['{CatalogNumber}', '{MFR}', '{Description}']) {
      const idx = fLine.toLowerCase().indexOf(tok.toLowerCase())
      if (idx >= 0) tokens.push({ token: tok, index: idx })
    }
    tokens.sort((a, b) => a.index - b.index)

    const words = cLine.split(/\s+/).filter(Boolean)
    let wordPos = 0

    for (let t = 0; t < tokens.length; t++) {
      const { token } = tokens[t]
      const isLast = t === tokens.length - 1

      if (wordPos >= words.length) break

      if (token.toLowerCase() === '{catalognumber}') {
        if (!catalogNumber) catalogNumber = words[wordPos]
        wordPos++
      } else if (token.toLowerCase() === '{mfr}') {
        if (!mfr) mfr = words[wordPos]
        wordPos++
      } else if (token.toLowerCase() === '{description}') {
        if (isLast) {
          if (!description) description = words.slice(wordPos).join(' ')
          wordPos = words.length
        } else {
          if (!description) description = words[wordPos]
          wordPos++
        }
      }
    }
  }

  if (!catalogNumber) return null
  return { mfr, description, catalogNumber }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CriteriaModalProps {
  supplier: Supplier
  onClose: () => void
}

export default function CriteriaModal({ supplier, onClose }: CriteriaModalProps) {
  const upsert = useUpsertCriteria(supplier.id)
  const [sampleKey, setSampleKey] = useState<keyof typeof SAMPLE_CELLS>('platt')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaSchema) as never,
    defaultValues: {
      matchColumn:      supplier.criteria?.matchColumn      ?? '',
      format:           supplier.criteria?.format           ?? '',
      colPrice:         supplier.criteria?.colPrice         ?? '',
      matchColX:        supplier.criteria?.matchColX        ?? null,
      priceColX:        supplier.criteria?.priceColX        ?? null,
      colDescription:   supplier.criteria?.colDescription   ?? '',
      colQuantity:      supplier.criteria?.colQuantity      ?? '',
      colTotal:         supplier.criteria?.colTotal         ?? '',
      colInvoiceNumber: supplier.criteria?.colInvoiceNumber ?? '',
    },
  })

  // Reset form whenever the supplier changes
  useEffect(() => {
    reset({
      matchColumn:      supplier.criteria?.matchColumn      ?? '',
      format:           supplier.criteria?.format           ?? '',
      colPrice:         supplier.criteria?.colPrice         ?? '',
      matchColX:        supplier.criteria?.matchColX        ?? null,
      priceColX:        supplier.criteria?.priceColX        ?? null,
      colDescription:   supplier.criteria?.colDescription   ?? '',
      colQuantity:      supplier.criteria?.colQuantity      ?? '',
      colTotal:         supplier.criteria?.colTotal         ?? '',
      colInvoiceNumber: supplier.criteria?.colInvoiceNumber ?? '',
    })
  }, [supplier, reset])

  const formatValue = watch('format')
  const preview = previewParse(formatValue, SAMPLE_CELLS[sampleKey])

  const onSubmit = async (values: CriteriaFormValues) => {
    await upsert.mutateAsync(values)
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Configure Comparison Criteria — {supplier.name}</DialogTitle>
          <DialogDescription>
            Define how this supplier's proposed price PDF is structured. The parser uses these
            settings to extract MFR, Description, and Catalog # from a single combined column.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">

            {/* Match Column */}
            <div className="space-y-1.5">
              <Label htmlFor="matchColumn">Match Column (combined key column header)</Label>
              <Input
                id="matchColumn"
                {...register('matchColumn')}
                placeholder='e.g. "EOP #/Description" (PLATT), "Product Code" (CED)'
              />
              <p className="text-xs text-muted-foreground">
                The exact column header text that contains MFR + Description + Catalog # together.
              </p>
              {errors.matchColumn && (
                <p className="text-xs text-destructive">{errors.matchColumn.message}</p>
              )}
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label htmlFor="format">Format Template</Label>
              <Input
                id="format"
                {...register('format')}
                placeholder='e.g. "{MFR} {Description}\n{CatalogNumber}"'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tokens:{' '}
                <code className="rounded bg-muted px-1 font-mono">{'{'+'MFR}'}</code>{' '}(single word),{' '}
                <code className="rounded bg-muted px-1 font-mono">{'{'+'Description}'}</code>{' '}(words),{' '}
                <code className="rounded bg-muted px-1 font-mono">{'{'+'CatalogNumber}'}</code>{' '}(no spaces).{' '}
                Use <code className="rounded bg-muted px-1 font-mono">\n</code> for a line break between lines.
              </p>
              {errors.format && (
                <p className="text-xs text-destructive">{errors.format.message}</p>
              )}

              {/* Live preview */}
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Format Preview
                  </p>
                  <div className="flex gap-1">
                    {(Object.keys(SAMPLE_CELLS) as Array<keyof typeof SAMPLE_CELLS>).map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSampleKey(k)}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                          sampleKey === k
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border hover:bg-muted'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Sample cell: </span>
                  <code className="rounded bg-background border px-1.5 py-0.5 font-mono whitespace-pre">
                    {SAMPLE_CELLS[sampleKey].replace('\n', '\\n')}
                  </code>
                </div>
                {preview ? (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-0.5">MFR</p>
                      <p className="font-medium font-mono bg-background border rounded px-1.5 py-0.5">
                        {preview.mfr || <span className="text-muted-foreground italic">—</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Description</p>
                      <p className="font-medium font-mono bg-background border rounded px-1.5 py-0.5 truncate">
                        {preview.description || <span className="text-muted-foreground italic">—</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Catalog #</p>
                      <p className="font-medium font-mono bg-background border rounded px-1.5 py-0.5">
                        {preview.catalogNumber || <span className="text-muted-foreground italic">—</span>}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {formatValue
                      ? 'Could not parse sample — check your format template.'
                      : 'Enter a format template above to see a live preview.'}
                  </p>
                )}
              </div>
            </div>

            {/* Price Column */}
            <div className="space-y-1.5">
              <Label htmlFor="colPrice">Price column header</Label>
              <Input
                id="colPrice"
                {...register('colPrice')}
                placeholder='e.g. "NET PRICE", "Unit Price", "Price"'
              />
              {errors.colPrice && (
                <p className="text-xs text-destructive">{errors.colPrice.message}</p>
              )}
            </div>

            {/* Separate Description Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="colDescription">
                Separate Description Column{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="colDescription"
                {...register('colDescription')}
                placeholder='e.g. "DESCRIPTION" (CED) — leave blank if description is inside the Match Column'
              />
              <p className="text-xs text-muted-foreground">
                If the supplier&apos;s spreadsheet has a dedicated Description column separate from the
                Match Column, enter its header here. MFR is always extracted from the Match Column
                using the Format Template above.
              </p>
            </div>

            {/* Quantity Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="colQuantity">
                Quantity Column{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="colQuantity"
                {...register('colQuantity')}
                placeholder='e.g. "Ship Qty", "Item Qty", "QTY"'
              />
              <p className="text-xs text-muted-foreground">
                The number of units on each invoice line. Used together with the Total Column
                to compute the expected total (Master Price × Quantity) for comparison.
              </p>
            </div>

            {/* Total Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="colTotal">
                Total Column{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="colTotal"
                {...register('colTotal')}
                placeholder='e.g. "Total", "Line Total", "Ext Price"'
              />
              <p className="text-xs text-muted-foreground">
                The invoice line total. Comparison checks this value against Master Price × Quantity.
                A positive difference means the invoice total exceeds the expected contract total.
              </p>
            </div>

            {/* Invoice Number Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="colInvoiceNumber">
                Invoice Number Column{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="colInvoiceNumber"
                {...register('colInvoiceNumber')}
                placeholder='e.g. "Invoice #", "Invoice Number", "INV #"'
              />
              <p className="text-xs text-muted-foreground">
                When set, the invoice number is extracted from each row and included in comparison
                results and the generated PDF report.
              </p>
            </div>

            {/* X-Anchor Overrides (advanced / optional) */}
            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none py-1">
                Advanced: Column X-Position Overrides <span className="font-normal">(optional)</span>
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Use these fields when the parser mis-identifies which data belongs to each column.
                  Enter the left X-coordinate (in PDF points) of the first data word in each column.
                  Leave blank to use the position detected automatically from the column header.
                  You can find the correct values by running the PdfDiag diagnostic tool against the supplier's PDF.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="matchColX">Match Column X</Label>
                    <Input
                      id="matchColX"
                      type="number"
                      step="0.1"
                      {...register('matchColX')}
                      placeholder="e.g. 73"
                    />
                    <p className="text-xs text-muted-foreground">Left edge of match column data</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="priceColX">Price Column X</Label>
                    <Input
                      id="priceColX"
                      type="number"
                      step="0.1"
                      {...register('priceColX')}
                      placeholder="e.g. 454"
                    />
                    <p className="text-xs text-muted-foreground">Left edge of price column data</p>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <DialogFooter className="mt-6 shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || upsert.isPending}>
              {upsert.isPending ? 'Saving…' : 'Save Criteria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
