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
import SupplierFormFields from './SupplierFormFields'
import { supplierSchema, type SupplierFormValues } from './supplierSchema'
import { useCreateSupplier } from '@/hooks/useSuppliers'

interface AddSupplierModalProps {
  open: boolean
  onClose: () => void
}

export default function AddSupplierModal({ open, onClose }: AddSupplierModalProps) {
  const createSupplier = useCreateSupplier()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues, unknown, SupplierFormValues>({
    resolver: zodResolver(supplierSchema) as never,
  })

  const onSubmit = async (values: SupplierFormValues) => {
    await createSupplier.mutateAsync(values)
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
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <SupplierFormFields register={register} errors={errors} />

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createSupplier.isPending}>
              {createSupplier.isPending ? 'Adding…' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
