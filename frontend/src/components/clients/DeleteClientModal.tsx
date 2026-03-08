import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteClient } from '@/hooks/useClients'
import type { Client } from '@/api/clients'

interface DeleteClientModalProps {
  client:  Client
  onClose: () => void
}

export default function DeleteClientModal({ client, onClose }: DeleteClientModalProps) {
  const deleteClient = useDeleteClient()

  const handleDelete = async () => {
    await deleteClient.mutateAsync(client.id)
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Client</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{client.name}</strong>? This will also remove
            all associated contacts ({client.contactCount}), projects ({client.projectCount}),
            and activity log entries ({client.activityCount}). This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteClient.isPending}
          >
            {deleteClient.isPending ? 'Deleting…' : 'Delete Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
