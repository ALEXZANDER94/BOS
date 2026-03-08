import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface ReportActionsProps {
  onGenerate: (includeNewItems: boolean) => void
  isGenerating: boolean
  resultCount: number
}

export default function ReportActions({
  onGenerate,
  isGenerating,
  resultCount,
}: ReportActionsProps) {
  const [includeNewItems, setIncludeNewItems] = useState(false)

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {resultCount} {resultCount === 1 ? 'item' : 'items'} ready — generate a printable PDF report
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-new-items"
            checked={includeNewItems}
            onCheckedChange={(v: boolean | 'indeterminate') => setIncludeNewItems(v === true)}
            disabled={isGenerating}
          />
          <Label htmlFor="include-new-items" className="cursor-pointer font-normal text-sm">
            Include new items in report
          </Label>
        </div>
      </div>
      <Button onClick={() => onGenerate(includeNewItems)} disabled={isGenerating} className="gap-2">
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {isGenerating ? 'Generating…' : 'Download PDF Report'}
      </Button>
    </div>
  )
}
