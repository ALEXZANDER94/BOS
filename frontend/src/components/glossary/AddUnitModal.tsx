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
import { useCreateUnit } from '@/hooks/useGlossary'

interface AddUnitModalProps {
  supplierId: number
  open: boolean
  onClose: () => void
}

export default function AddUnitModal({ supplierId, open, onClose }: AddUnitModalProps) {
  const createUnit = useCreateUnit(supplierId)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues, unknown, UnitFormValues>({
    resolver: zodResolver(unitSchema) as never,
    defaultValues: { statusId: null },
  })

  const onSubmit = async (values: UnitFormValues) => {
    await createUnit.mutateAsync(values)
    reset()
    onClose()
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <UnitFormFields register={register} errors={errors} setValue={setValue} watch={watch} />

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createUnit.isPending}>
              {createUnit.isPending ? 'Adding…' : 'Add Unit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
