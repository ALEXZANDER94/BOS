import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface GlossarySearchProps {
  value: string
  onChange: (value: string) => void
}

export default function GlossarySearch({ value, onChange }: GlossarySearchProps) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search by catalog #, description, or MFR…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
