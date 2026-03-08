import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteSupplier } from '@/hooks/useSuppliers'
import type { Supplier } from '@/api/suppliers'

interface DeleteSupplierConfirmModalProps {
  supplier: Supplier
  onClose: () => void
}

export default function DeleteSupplierConfirmModal({ supplier, onClose }: DeleteSupplierConfirmModalProps) {
  const deleteSupplier = useDeleteSupplier()

  const handleConfirm = async () => {
    await deleteSupplier.mutateAsync(supplier.id)
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Supplier?</DialogTitle>
          <DialogDescription>
            This will permanently remove{' '}
            <span className="font-semibold text-foreground">{supplier.name}</span>{' '}
            and <strong>all of its glossary units</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleteSupplier.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteSupplier.isPending}
          >
            {deleteSupplier.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
