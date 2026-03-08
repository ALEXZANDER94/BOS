import { useState } from 'react'
import { Plus, Pencil, Trash2, Building2, SlidersHorizontal } from 'lucide-react'
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
import AddSupplierModal from '@/components/suppliers/AddSupplierModal'
import EditSupplierModal from '@/components/suppliers/EditSupplierModal'
import DeleteSupplierConfirmModal from '@/components/suppliers/DeleteSupplierConfirmModal'
import CriteriaModal from '@/components/suppliers/CriteriaModal'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { Supplier } from '@/api/suppliers'

export default function SuppliersPage() {
  const [addOpen, setAddOpen]               = useState(false)
  const [editTarget, setEditTarget]         = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget]     = useState<Supplier | null>(null)
  const [criteriaTarget, setCriteriaTarget] = useState<Supplier | null>(null)

  const { data: suppliers = [], isLoading } = useSuppliers()

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Suppliers</h2>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'} — each with its own master glossary
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No suppliers yet</p>
          <p className="text-xs text-muted-foreground">
            Add a supplier to get started. Each supplier has its own unit glossary.
          </p>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Supplier
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(supplier => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {supplier.name}
                      {supplier.criteria && (
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] border-green-400 text-green-700 bg-green-50"
                        >
                          Criteria
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.domain}</TableCell>
                  <TableCell>
                    {supplier.website ? (
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline text-sm"
                      >
                        {supplier.website}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCriteriaTarget(supplier)}
                        title="Configure comparison criteria"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="sr-only">Configure Criteria</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTarget(supplier)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(supplier)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modals */}
      <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editTarget && (
        <EditSupplierModal supplier={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteSupplierConfirmModal supplier={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
      {criteriaTarget && (
        <CriteriaModal supplier={criteriaTarget} onClose={() => setCriteriaTarget(null)} />
      )}
    </div>
  )
}
