import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ClientTable from '@/components/clients/ClientTable'
import AddClientModal from '@/components/clients/AddClientModal'
import EditClientModal from '@/components/clients/EditClientModal'
import DeleteClientModal from '@/components/clients/DeleteClientModal'
import { useClients } from '@/hooks/useClients'
import type { Client } from '@/api/clients'

type StatusFilter = '' | 'Active' | 'Inactive'

export default function ClientsPage() {
  const navigate = useNavigate()

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState<Client | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  const { data: clients = [], isLoading } = useClients(
    search || undefined,
    statusFilter || undefined
  )

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}${search ? ` matching "${search}"` : ''}`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or industry…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter || 'all'}
          onValueChange={v => setStatusFilter(v === 'all' ? '' : v as StatusFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table — row/view click navigates to the detail page */}
      <ClientTable
        clients={clients}
        isLoading={isLoading}
        onView={client => navigate(`/clients/${client.id}`)}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />

      {/* Modals */}
      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      {editTarget && (
        <EditClientModal
          client={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteClientModal
          client={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
