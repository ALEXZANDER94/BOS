import { useState } from 'react'
import { Tag, X, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useEmailCategories } from '@/hooks/useEmailCategories'
import { useEmailAssignment, useUpsertAssignment, useRemoveAssignment } from '@/hooks/useEmailCategories'

interface Props {
  messageId: string
  noteKey?:  string   // RFC Message-ID when available — used as the stable cross-user assignment key
}

export function EmailAssignmentPanel({ messageId, noteKey }: Props) {
  // Use the RFC Message-ID as the canonical key so all group members share the same assignment.
  const key = noteKey ?? messageId

  const { data: categories = [] }  = useEmailCategories()
  const { data: assignment }        = useEmailAssignment(key)
  const upsert                      = useUpsertAssignment()
  const remove                      = useRemoveAssignment()

  const [editing, setEditing]       = useState(false)
  const [pendingCategoryId, setPendingCategoryId] = useState<string>('')
  const [pendingStatusId, setPendingStatusId]     = useState<string>('none')

  const selectedCategory = categories.find(c => c.id === parseInt(pendingCategoryId))

  function startEditing() {
    setPendingCategoryId(assignment ? String(assignment.categoryId) : '')
    setPendingStatusId(assignment?.statusId ? String(assignment.statusId) : 'none')
    setEditing(true)
  }

  function handleSave() {
    const catId = parseInt(pendingCategoryId)
    if (isNaN(catId)) return
    const statusId = pendingStatusId === 'none' ? null : parseInt(pendingStatusId)
    upsert.mutate(
      { messageId: key, categoryId: catId, statusId },
      { onSuccess: () => setEditing(false) }
    )
  }

  function handleRemove() {
    remove.mutate(key)
  }

  // ── Editing mode ──────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={pendingCategoryId} onValueChange={v => {
            setPendingCategoryId(v)
            setPendingStatusId('none')
          }}>
            <SelectTrigger size="sm" className="h-7 text-xs flex-1">
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span
                    className="inline-block h-2 w-2 rounded-full mr-1.5"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCategory && selectedCategory.statuses.length > 0 && (
          <div className="flex items-center gap-2 pl-5">
            <Select value={pendingStatusId} onValueChange={setPendingStatusId}>
              <SelectTrigger size="sm" className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No status</SelectItem>
                {selectedCategory.statuses.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1.5"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 pl-5">
          <Button size="sm" className="h-6 text-xs px-2" onClick={handleSave}
            disabled={!pendingCategoryId || upsert.isPending}>
            Save
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
            onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Display mode ──────────────────────────────────────────────────────────

  if (!assignment) {
    return (
      <div className="flex items-center gap-2">
        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground italic">Uncategorized</span>
        <Button variant="ghost" size="sm" className="h-5 text-[11px] px-1.5 ml-auto"
          onClick={startEditing}>
          Assign <ChevronDown className="h-3 w-3 ml-0.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 flex-wrap">
      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        <button onClick={startEditing}>
          <Badge
            className="text-[10px] h-5 px-2 cursor-pointer hover:opacity-80"
            style={{ backgroundColor: assignment.categoryColor, color: '#fff', border: 'none' }}
          >
            {assignment.categoryName}
          </Badge>
        </button>
        {assignment.statusName && (
          <button onClick={startEditing}>
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-2 cursor-pointer hover:opacity-80"
              style={{ borderColor: assignment.statusColor ?? undefined, color: assignment.statusColor ?? undefined }}
            >
              {assignment.statusName}
            </Badge>
          </button>
        )}
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive ml-auto"
          title="Remove category"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
