import { Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Client } from '@/api/clients'

interface ClientTableProps {
  clients:   Client[]
  isLoading: boolean
  onView:    (client: Client) => void
  onEdit:    (client: Client) => void
  onDelete:  (client: Client) => void
}

export default function ClientTable({
  clients,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: ClientTableProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">Loading clients…</p>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm text-muted-foreground">No clients found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Primary Contact</TableHead>
            <TableHead className="text-center">Projects</TableHead>
            <TableHead className="text-center">Activity</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => (
            <TableRow
              key={client.id}
              className="cursor-pointer"
              onClick={() => onView(client)}
            >
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {client.industry || <span className="italic">—</span>}
              </TableCell>
              <TableCell>
                <Badge
                  variant={client.status === 'Active' ? 'default' : 'secondary'}
                  className={client.status === 'Active'
                    ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400'
                    : ''}
                >
                  {client.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {client.primaryContact ? (
                  <span>
                    {client.primaryContact.name}
                    {client.primaryContact.email && (
                      <span className="text-muted-foreground ml-1">
                        — {client.primaryContact.email}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{client.projectCount}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{client.activityCount}</Badge>
              </TableCell>
              <TableCell onClick={e => e.stopPropagation()}>
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onEdit(client)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(client)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onView(client)}
                    title="View detail"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
