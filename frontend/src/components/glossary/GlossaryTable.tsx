import { Pencil, Trash2, NotebookText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { GlossaryUnit } from '@/api/glossary'
import { StatusBadge } from './StatusBadge'

interface GlossaryTableProps {
  units: GlossaryUnit[]
  isLoading: boolean
  onEdit: (unit: GlossaryUnit) => void
  onDelete: (unit: GlossaryUnit) => void
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function GlossaryTable({
  units,
  isLoading,
  onEdit,
  onDelete,
}: GlossaryTableProps) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading units…</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Catalog #</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>MFR</TableHead>
            <TableHead className="text-right">Contracted Price</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-10 text-center">Notes</TableHead>
            <TableHead className="w-20 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                No units found. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            units.map(unit => (
              <TableRow key={unit.id}>
                <TableCell className="font-mono text-sm">{unit.catalogNumber}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {unit.description}
                    {unit.addedVia === 'Comparison' && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 shrink-0"
                        title="Added to glossary from a price comparison"
                      >
                        Via Comparison
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{unit.mfr}</TableCell>
                <TableCell className="text-right font-medium">
                  {currency.format(unit.contractedPrice)}
                </TableCell>
                <TableCell>
                  {unit.statusName && unit.statusColor ? (
                    <StatusBadge name={unit.statusName} color={unit.statusColor} />
                  ) : null}
                </TableCell>
                <TableCell className="text-center">
                  {unit.notes ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View notes for ${unit.catalogNumber}`}
                        >
                          <NotebookText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap break-words">{unit.notes}</p>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(unit)}
                      aria-label={`Edit ${unit.catalogNumber}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(unit)}
                      aria-label={`Delete ${unit.catalogNumber}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
