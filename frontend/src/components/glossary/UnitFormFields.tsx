// Shared form field layout reused by AddUnitModal and EditUnitModal.
// Accepts a react-hook-form 'register', 'setValue', 'watch', and 'errors' so each modal owns its own form state.
import { useState } from 'react'
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import type { UnitFormValues } from './unitSchema'
import { useUnitStatuses, useCreateUnitStatus } from '@/hooks/useUnitStatuses'
import { StatusBadge } from './StatusBadge'

// 10 preset color swatches (shared with StatusManagerDialog)
export const STATUS_COLORS = [
  '#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

interface UnitFormFieldsProps {
  register:   UseFormRegister<UnitFormValues>
  errors:     FieldErrors<UnitFormValues>
  setValue:   UseFormSetValue<UnitFormValues>
  watch:      UseFormWatch<UnitFormValues>
  showNotes?: boolean
}

export default function UnitFormFields({ register, errors, setValue, watch, showNotes = false }: UnitFormFieldsProps) {
  const statusId = watch('statusId') ?? null
  const { data: statuses = [], isLoading: statusesLoading } = useUnitStatuses()
  const createStatus = useCreateUnitStatus()

  // Inline "+ New Status" form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState(STATUS_COLORS[6]) // default blue

  const handleCreateStatus = async () => {
    if (!newName.trim()) return
    const created = await createStatus.mutateAsync({ name: newName.trim(), color: newColor })
    setValue('statusId', created.id)
    setNewName('')
    setNewColor(STATUS_COLORS[6])
    setShowNewForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="catalogNumber">Catalog #</Label>
        <Input id="catalogNumber" {...register('catalogNumber')} placeholder="e.g. ABC-1234" />
        {errors.catalogNumber && (
          <p className="text-xs text-destructive">{errors.catalogNumber.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} placeholder="Unit description" />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mfr">MFR</Label>
        <Input id="mfr" {...register('mfr')} placeholder="Manufacturer name" />
        {errors.mfr && (
          <p className="text-xs text-destructive">{errors.mfr.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={statusId != null ? String(statusId) : '__none__'}
          onValueChange={(val) => setValue('statusId', val === '__none__' ? null : Number(val))}
          disabled={statusesLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={statusesLoading ? 'Loading…' : '— None —'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {statuses.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>
                <span className="flex items-center gap-2">
                  <StatusBadge name={s.name} color={s.color} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Inline "+ New Status" toggle */}
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Status
          </button>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <Input
              placeholder="Status name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-1 flex-wrap">
              {STATUS_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? '#000' : 'transparent',
                  }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={!newName.trim() || createStatus.isPending}
                onClick={handleCreateStatus}
              >
                {createStatus.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowNewForm(false); setNewName(''); setNewColor(STATUS_COLORS[6]) }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contractedPrice">Contracted Price ($)</Label>
        <Input
          id="contractedPrice"
          type="number"
          step="0.01"
          min="0"
          {...register('contractedPrice')}
          placeholder="0.00"
        />
        {errors.contractedPrice && (
          <p className="text-xs text-destructive">{errors.contractedPrice.message}</p>
        )}
      </div>

      {showNotes && (
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Optional notes about this unit"
            className="min-h-20 resize-y"
          />
          {errors.notes && (
            <p className="text-xs text-destructive">{errors.notes.message}</p>
          )}
        </div>
      )}
    </div>
  )
}
