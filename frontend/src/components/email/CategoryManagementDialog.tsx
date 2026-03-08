import { useState } from 'react'
import { Settings2, Trash2, Plus, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  useEmailCategories,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useAddCategoryStatus, useUpdateCategoryStatus, useDeleteCategoryStatus,
} from '@/hooks/useEmailCategories'
import type { EmailCategory, EmailCategoryStatus } from '@/api/emailCategories'

// ── Inline editable row for a status ─────────────────────────────────────────

function StatusRow({ status, categoryId }: { status: EmailCategoryStatus; categoryId: number }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(status.name)
  const [color, setColor]     = useState(status.color)

  const updateStatus = useUpdateCategoryStatus()
  const deleteStatus = useDeleteCategoryStatus()

  function handleSave() {
    if (!name.trim()) return
    updateStatus.mutate(
      { categoryId, statusId: status.id, data: { name, color, displayOrder: status.displayOrder } },
      { onSuccess: () => setEditing(false) }
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 pl-4 pr-2 py-1.5">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-5 w-5 rounded cursor-pointer border-0 p-0 shrink-0"
        />
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-6 text-xs flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          autoFocus
        />
        <button onClick={handleSave} className="text-green-600 hover:text-green-700">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setEditing(false); setName(status.name); setColor(status.color) }}
          className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 pl-4 pr-2 py-1.5 group">
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span className="text-xs flex-1 truncate">{status.name}</span>
      <div className="hidden group-hover:flex items-center gap-1">
        <button onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => deleteStatus.mutate({ categoryId, statusId: status.id })}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── Add-status inline form ────────────────────────────────────────────────────

function AddStatusForm({ categoryId, onCancel }: { categoryId: number; onCancel: () => void }) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState('#6b7280')
  const addStatus         = useAddCategoryStatus()

  function handleAdd() {
    if (!name.trim()) return
    addStatus.mutate(
      { categoryId, data: { name, color } },
      { onSuccess: () => { setName(''); setColor('#6b7280'); onCancel() } }
    )
  }

  return (
    <div className="flex items-center gap-2 pl-4 pr-2 py-1.5">
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="h-5 w-5 rounded cursor-pointer border-0 p-0 shrink-0"
      />
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Status name…"
        className="h-6 text-xs flex-1"
        onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        autoFocus
      />
      <button onClick={handleAdd} className="text-green-600 hover:text-green-700">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Category row ──────────────────────────────────────────────────────────────

function CategoryRow({ category }: { category: EmailCategory }) {
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [addingStatus, setAddingStatus] = useState(false)
  const [name, setName]           = useState(category.name)
  const [color, setColor]         = useState(category.color)

  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  function handleSave() {
    if (!name.trim()) return
    updateCategory.mutate(
      { id: category.id, data: { name, color } },
      { onSuccess: () => setEditing(false) }
    )
  }

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 group">
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {editing ? (
          <>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-5 w-5 rounded cursor-pointer border-0 p-0 shrink-0"
            />
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-6 text-xs flex-1"
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
            <button onClick={handleSave} className="text-green-600 hover:text-green-700">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setEditing(false); setName(category.name); setColor(category.color) }}
              className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm font-medium flex-1 truncate">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              {category.statuses.length} status{category.statuses.length !== 1 ? 'es' : ''}
            </span>
            <div className="hidden group-hover:flex items-center gap-1 ml-1">
              <button onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteCategory.mutate(category.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Statuses (expanded) */}
      {expanded && (
        <div className="divide-y divide-border">
          {category.statuses.map(s => (
            <StatusRow key={s.id} status={s} categoryId={category.id} />
          ))}
          {addingStatus ? (
            <AddStatusForm categoryId={category.id} onCancel={() => setAddingStatus(false)} />
          ) : (
            <button
              onClick={() => setAddingStatus(true)}
              className="flex items-center gap-1.5 pl-4 pr-2 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
            >
              <Plus className="h-3 w-3" /> Add status
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add-category form ─────────────────────────────────────────────────────────

function AddCategoryForm() {
  const [name, setName]     = useState('')
  const [color, setColor]   = useState('#6b7280')
  const [open, setOpen]     = useState(false)
  const createCategory      = useCreateCategory()

  function handleCreate() {
    if (!name.trim()) return
    createCategory.mutate(
      { name, color },
      { onSuccess: () => { setName(''); setColor('#6b7280'); setOpen(false) } }
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Category
      </Button>
    )
  }

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-6 w-6 rounded cursor-pointer border-0 p-0 shrink-0"
        />
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Category name…"
          className="h-7 text-sm flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          autoFocus
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
      </div>
    </div>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export function CategoryManagementDialog() {
  const { data: categories = [] } = useEmailCategories()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No categories yet. Create one below.
            </p>
          )}
          {categories.map(c => (
            <CategoryRow key={c.id} category={c} />
          ))}
          <AddCategoryForm />
        </div>
      </DialogContent>
    </Dialog>
  )
}
