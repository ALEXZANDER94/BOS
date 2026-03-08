import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import UnitFormFields from './UnitFormFields'
import { unitSchema, type UnitFormValues } from './unitSchema'
import { useUpdateUnit } from '@/hooks/useGlossary'
import type { GlossaryUnit } from '@/api/glossary'

interface EditUnitModalProps {
  supplierId: number
  unit: GlossaryUnit
  onClose: () => void
}

export default function EditUnitModal({ supplierId, unit, onClose }: EditUnitModalProps) {
  const updateUnit = useUpdateUnit(supplierId)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues, unknown, UnitFormValues>({
    resolver: zodResolver(unitSchema) as never,
    // Pre-populate the form with the unit's current values
    defaultValues: {
      catalogNumber:   unit.catalogNumber,
      description:     unit.description,
      mfr:             unit.mfr,
      statusId:        unit.statusId ?? null,
      contractedPrice: unit.contractedPrice,
      notes:           unit.notes ?? null,
    },
  })

  // When a different unit is passed in (e.g. user clicks Edit on another row),
  // reset the form to that unit's values.
  useEffect(() => {
    reset({
      catalogNumber:   unit.catalogNumber,
      description:     unit.description,
      mfr:             unit.mfr,
      statusId:        unit.statusId ?? null,
      contractedPrice: unit.contractedPrice,
      notes:           unit.notes ?? null,
    })
  }, [unit, reset])

  const onSubmit = async (values: UnitFormValues) => {
    await updateUnit.mutateAsync({ id: unit.id, data: values })
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Unit — {unit.catalogNumber}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <UnitFormFields register={register} errors={errors} setValue={setValue} watch={watch} showNotes />

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || updateUnit.isPending}>
              {updateUnit.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
