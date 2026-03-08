import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ComparisonResult } from '@/api/comparison'
import { glossaryApi } from '@/api/glossary'

interface ComparisonTableProps {
  results:              ComparisonResult[]
  supplierId:           number
  onNewItemsAdded?:     () => void
  onReviewUnmatched?:   () => void
  reviewState?:         'idle' | 'done'
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

type AddState = 'idle' | 'adding' | 'done'

export default function ComparisonTable({
  results,
  supplierId,
  onNewItemsAdded,
  onReviewUnmatched,
  reviewState = 'idle',
}: ComparisonTableProps) {
  const [addState, setAddState] = useState<AddState>('idle')

  const overpriced     = results.filter(r => r.isOverpriced && !r.isNewItem && !r.isNeedsReview).length
  const newItems       = results.filter(r => r.isNewItem).length
  const unmatchedCount = results.filter(r => r.isNeedsReview).length
  const netImpact      = results.reduce((sum, r) => sum + r.dollarDifference, 0)

  const handleAddAll = async () => {
    setAddState('adding')
    const newRows = results.filter(r => r.isNewItem)
    let added = 0

    for (const row of newRows) {
      try {
        await glossaryApi.create(supplierId, {
          catalogNumber:   row.catalogNumber,
          description:     row.description,
          mfr:             row.mfr,
          contractedPrice: row.proposedPrice,
          addedVia:        'Comparison',
        })
        added++
      } catch (err: unknown) {
        // 409 Conflict = already exists in glossary — silently skip
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status !== 409) {
          toast.error(`Failed to add ${row.catalogNumber} to glossary.`)
        }
      }
    }

    setAddState('done')
    if (added > 0) {
      toast.success(`${added} new item${added !== 1 ? 's' : ''} added to the glossary.`)
      onNewItemsAdded?.()
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-md border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">Total items: </span>
          <span className="font-semibold">{results.length}</span>
        </div>
        <div className="rounded-md border bg-red-50 px-4 py-2 text-sm dark:bg-red-950/20">
          <span className="text-muted-foreground">Overpriced: </span>
          <span className="font-semibold text-destructive">{overpriced}</span>
        </div>

        {/* New items chip — interactive when items can be added */}
        {newItems > 0 && addState === 'idle' && (
          <button
            onClick={handleAddAll}
            className="rounded-md border bg-yellow-50 px-4 py-2 text-sm text-left transition-colors hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40 cursor-pointer"
          >
            <span className="text-muted-foreground">New / unknown: </span>
            <span className="font-semibold text-yellow-700 dark:text-yellow-400">{newItems}</span>
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
              — Add all to glossary →
            </span>
          </button>
        )}
        {newItems > 0 && addState === 'adding' && (
          <div className="rounded-md border bg-yellow-50 px-4 py-2 text-sm dark:bg-yellow-950/20">
            <span className="text-muted-foreground animate-pulse">Adding to glossary…</span>
          </div>
        )}
        {newItems > 0 && addState === 'done' && (
          <div className="rounded-md border bg-green-50 px-4 py-2 text-sm dark:bg-green-950/20">
            <span className="text-muted-foreground">New items: </span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              ✓ Added to glossary
            </span>
          </div>
        )}
        {newItems === 0 && (
          <div className="rounded-md border bg-yellow-50 px-4 py-2 text-sm dark:bg-yellow-950/20">
            <span className="text-muted-foreground">New / unknown: </span>
            <span className="font-semibold text-yellow-700 dark:text-yellow-400">0</span>
          </div>
        )}

        <div className={cn(
          'rounded-md border px-4 py-2 text-sm',
          netImpact > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'
        )}>
          <span className="text-muted-foreground">Net impact: </span>
          <span className={cn('font-semibold', netImpact > 0 ? 'text-destructive' : 'text-green-700 dark:text-green-400')}>
            {currency.format(netImpact)}
          </span>
        </div>

        {/* Unmatched rows chip */}
        {unmatchedCount > 0 && reviewState === 'idle' && onReviewUnmatched && (
          <button
            onClick={onReviewUnmatched}
            className="rounded-md border bg-orange-50 px-4 py-2 text-sm text-left transition-colors hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/40 cursor-pointer"
          >
            <span className="text-muted-foreground">Unmatched: </span>
            <span className="font-semibold text-orange-700 dark:text-orange-400">{unmatchedCount}</span>
            <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
              — Review →
            </span>
          </button>
        )}
        {unmatchedCount > 0 && reviewState === 'done' && (
          <div className="rounded-md border bg-green-50 px-4 py-2 text-sm dark:bg-green-950/20">
            <span className="text-muted-foreground">Unmatched rows: </span>
            <span className="font-semibold text-green-700 dark:text-green-400">✓ Reviewed</span>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-24">Invoice #</TableHead>
              <TableHead className="w-32">Catalog #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-16 text-right">Qty</TableHead>
              <TableHead className="text-right">Master Price</TableHead>
              <TableHead className="text-right">Invoice Price/Unit</TableHead>
              <TableHead className="text-right">Exp. Total</TableHead>
              <TableHead className="text-right">Invoice Total</TableHead>
              <TableHead className="text-right">Diff ($)</TableHead>
              <TableHead className="text-right">Diff (%)</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, idx) => {
              const expTotal = row.masterPrice * row.proposedQuantity
              return (
                <TableRow
                  key={`${row.invoiceNumber}-${row.catalogNumber}-${idx}`}
                  className={cn(
                    row.isNeedsReview                    && 'bg-orange-50 dark:bg-orange-950/20',
                    !row.isNeedsReview && row.isNewItem  && 'bg-yellow-50 dark:bg-yellow-950/20',
                    !row.isNeedsReview && !row.isNewItem && row.isOverpriced && 'bg-red-50 dark:bg-red-950/20'
                  )}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.invoiceNumber || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.catalogNumber}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.proposedQuantity > 0 ? row.proposedQuantity : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.masterPrice > 0 ? currency.format(row.masterPrice) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currency.format(row.proposedPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {expTotal > 0 ? currency.format(expTotal) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.proposedTotal > 0 ? currency.format(row.proposedTotal) : '—'}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right font-medium tabular-nums',
                    row.dollarDifference > 0 && 'text-destructive'
                  )}>
                    {row.dollarDifference !== 0 ? currency.format(row.dollarDifference) : '—'}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right font-medium tabular-nums',
                    row.percentDifference > 0 && 'text-destructive'
                  )}>
                    {row.masterPrice > 0 ? fmtPct(row.percentDifference) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.isNeedsReview ? (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                        Unmatched
                      </Badge>
                    ) : row.isNewItem ? (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
                        New Item
                      </Badge>
                    ) : row.isOverpriced ? (
                      <Badge variant="destructive">Overpriced</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-green-700 dark:text-green-400">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  )
}
