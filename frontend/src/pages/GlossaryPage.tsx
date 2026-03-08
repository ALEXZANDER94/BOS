import { useState } from 'react'
import { Plus, Upload, Building2, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import GlossarySearch from '@/components/glossary/GlossarySearch'
import GlossaryTable from '@/components/glossary/GlossaryTable'
import AddUnitModal from '@/components/glossary/AddUnitModal'
import EditUnitModal from '@/components/glossary/EditUnitModal'
import DeleteConfirmModal from '@/components/glossary/DeleteConfirmModal'
import ImportCsvModal from '@/components/glossary/ImportCsvModal'
import StatusManagerDialog from '@/components/glossary/StatusManagerDialog'
import { useGlossaryUnits } from '@/hooks/useGlossary'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { GlossaryUnit } from '@/api/glossary'

export default function GlossaryPage() {
  const navigate = useNavigate()
  const [search, setSearch]                         = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [addOpen, setAddOpen]                       = useState(false)
  const [importOpen, setImportOpen]                 = useState(false)
  const [statusesOpen, setStatusesOpen]             = useState(false)
  const [editTarget, setEditTarget]                 = useState<GlossaryUnit | null>(null)
  const [deleteTarget, setDeleteTarget]             = useState<GlossaryUnit | null>(null)

  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers()

  // search is passed as a query param — React Query keeps separate cache entries
  // per search string, so typing in the box fetches filtered results from the API.
  const { data: units = [], isLoading: unitsLoading } = useGlossaryUnits(
    selectedSupplierId ?? 0,
    search || undefined
  )

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Unit Glossary</h2>
          <p className="text-sm text-muted-foreground">
            {selectedSupplier
              ? `${units.length} ${units.length === 1 ? 'unit' : 'units'}${search ? ` matching "${search}"` : ''} — ${selectedSupplier.name}`
              : 'Select a supplier to view its master glossary'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStatusesOpen(true)}
          >
            <Settings2 className="mr-1.5 h-4 w-4" />
            Statuses
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            disabled={!selectedSupplierId}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={!selectedSupplierId}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Unit
          </Button>
        </div>
      </div>

      {/* Supplier selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground shrink-0">Supplier</label>
        {suppliersLoading ? (
          <p className="text-sm text-muted-foreground">Loading suppliers…</p>
        ) : suppliers.length === 0 ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">No suppliers found.</p>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/suppliers')}>
              <Building2 className="mr-1 h-3.5 w-3.5" />
              Add a supplier
            </Button>
          </div>
        ) : (
          <Select
            value={selectedSupplierId?.toString() ?? ''}
            onValueChange={(val) => {
              setSelectedSupplierId(Number(val))
              setSearch('')
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a supplier…" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Body — gated on supplier selection */}
      {!selectedSupplierId ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {suppliers.length === 0
              ? 'No suppliers yet — add one from the Suppliers page.'
              : 'Select a supplier above to view its glossary.'}
          </p>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <GlossarySearch value={search} onChange={setSearch} />

          {/* Data table */}
          <GlossaryTable
            units={units}
            isLoading={unitsLoading}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
          />
        </>
      )}

      {/* Modals — rendered conditionally so their forms reset on close */}
      {selectedSupplierId && (
        <>
          <AddUnitModal
            supplierId={selectedSupplierId}
            open={addOpen}
            onClose={() => setAddOpen(false)}
          />
          <ImportCsvModal
            supplierId={selectedSupplierId}
            open={importOpen}
            onClose={() => setImportOpen(false)}
          />
        </>
      )}
      {editTarget && selectedSupplierId && (
        <EditUnitModal
          supplierId={selectedSupplierId}
          unit={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && selectedSupplierId && (
        <DeleteConfirmModal
          supplierId={selectedSupplierId}
          unit={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Status manager — available regardless of supplier selection */}
      <StatusManagerDialog
        open={statusesOpen}
        onClose={() => setStatusesOpen(false)}
      />
    </div>
  )
}
