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
import SupplierFormFields from './SupplierFormFields'
import { supplierSchema, type SupplierFormValues } from './supplierSchema'
import { useUpdateSupplier } from '@/hooks/useSuppliers'
import type { Supplier } from '@/api/suppliers'

interface EditSupplierModalProps {
  supplier: Supplier
  onClose: () => void
}

export default function EditSupplierModal({ supplier, onClose }: EditSupplierModalProps) {
  const updateSupplier = useUpdateSupplier()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues, unknown, SupplierFormValues>({
    resolver: zodResolver(supplierSchema) as never,
    defaultValues: {
      name:    supplier.name,
      domain:  supplier.domain,
      website: supplier.website,
    },
  })

  // When a different supplier is passed in, reset to its values
  useEffect(() => {
    reset({
      name:    supplier.name,
      domain:  supplier.domain,
      website: supplier.website,
    })
  }, [supplier, reset])

  const onSubmit = async (values: SupplierFormValues) => {
    await updateSupplier.mutateAsync({ id: supplier.id, data: values })
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Supplier — {supplier.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <SupplierFormFields register={register} errors={errors} />

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || updateSupplier.isPending}>
              {updateSupplier.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
