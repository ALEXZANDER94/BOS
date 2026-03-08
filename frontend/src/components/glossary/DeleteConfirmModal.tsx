import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteUnit } from '@/hooks/useGlossary'
import type { GlossaryUnit } from '@/api/glossary'

interface DeleteConfirmModalProps {
  supplierId: number
  unit: GlossaryUnit
  onClose: () => void
}

export default function DeleteConfirmModal({ supplierId, unit, onClose }: DeleteConfirmModalProps) {
  const deleteUnit = useDeleteUnit(supplierId)

  const handleConfirm = async () => {
    await deleteUnit.mutateAsync(unit.id)
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Unit?</DialogTitle>
          <DialogDescription>
            This will permanently remove{' '}
            <span className="font-semibold text-foreground">{unit.catalogNumber}</span>{' '}
            — {unit.description} — from the master glossary. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleteUnit.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteUnit.isPending}
          >
            {deleteUnit.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
