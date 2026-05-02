import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FileText, Plus, Pencil, Trash2, ExternalLink, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { libraryApi, type LibraryListItem } from '@/api/libraries'
import { customUpgradeApi } from '@/api/customUpgrades'

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface LibrariesPanelProps {
  clientId: number
}

export default function LibrariesPanel({ clientId }: LibrariesPanelProps) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ['libraries', clientId],
    queryFn: () => libraryApi.getForClient(clientId),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => libraryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['libraries', clientId] })
      toast.success('Library deleted')
    },
    onError: () => toast.error('Failed to delete library'),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable building schematics. Available to all proposals across every client.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Library
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : libraries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No libraries yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {libraries.map(lib => (
            <LibraryCard
              key={lib.id}
              library={lib}
              onView={() => setDetailId(lib.id)}
              onEdit={() => setEditingId(lib.id)}
              onDelete={() => {
                if (confirm(`Delete library "${lib.title}"? This cannot be undone.`))
                  deleteMutation.mutate(lib.id)
              }}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <LibraryFormDialog
          mode="create"
          clientId={clientId}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {editingId !== null && (
        <LibraryFormDialog
          mode="edit"
          clientId={clientId}
          libraryId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
      {detailId !== null && (
        <LibraryDetailDialog
          libraryId={detailId}
          clientId={clientId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface LibraryCardProps {
  library: LibraryListItem
  onView:   () => void
  onEdit:   () => void
  onDelete: () => void
}

function LibraryCard({ library, onView, onEdit, onDelete }: LibraryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2 shrink-0">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <button onClick={onView} className="text-left w-full">
            <h4 className="text-sm font-semibold truncate hover:underline">{library.title}</h4>
            {library.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {library.description}
              </p>
            )}
          </button>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            {library.originalFileName ? (
              <>
                <span className="truncate" title={library.originalFileName}>
                  {library.originalFileName}
                </span>
                <span>{fmtBytes(library.contentLength)}</span>
              </>
            ) : (
              <span className="italic">No PDF uploaded</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit} title="Edit">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Create / edit dialog ──────────────────────────────────────────────────────

interface LibraryFormDialogProps {
  mode:       'create' | 'edit'
  clientId:   number
  libraryId?: number
  onClose:    () => void
}

function LibraryFormDialog({ mode, clientId, libraryId, onClose }: LibraryFormDialogProps) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: existing } = useQuery({
    queryKey: ['library', libraryId],
    queryFn:  () => libraryApi.getById(libraryId!),
    enabled:  mode === 'edit' && libraryId !== undefined,
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)

  // Sync form when existing data loads
  if (existing && title === '' && description === '' && existing.title !== '') {
    setTitle(existing.title)
    setDescription(existing.description)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        return libraryApi.create(clientId, title, description, pdf)
      }
      return libraryApi.update(libraryId!, title, description, pdf)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['libraries', clientId] })
      qc.invalidateQueries({ queryKey: ['library', libraryId] })
      toast.success(mode === 'create' ? 'Library created' : 'Library updated')
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data ?? err?.message ?? 'Save failed')
    },
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error('File must be a PDF')
      return
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error('PDF must be 25 MB or smaller')
      return
    }
    setPdf(f)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Library' : 'Edit Library'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              PDF <span className="text-muted-foreground">(optional — can be added later)</span>
              {mode === 'edit' && existing && existing.originalFileName && (
                <span className="ml-2 text-muted-foreground">
                  (current: {existing.originalFileName} — {fmtBytes(existing.contentLength)})
                </span>
              )}
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFile}
              className="text-xs"
            />
            {pdf && (
              <p className="text-[10px] text-muted-foreground">
                Selected: {pdf.name} ({fmtBytes(pdf.size)})
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail dialog (PDF link + baked-in upgrades) ──────────────────────────────

interface LibraryDetailDialogProps {
  libraryId: number
  clientId:  number
  onClose:   () => void
}

function LibraryDetailDialog({ libraryId, clientId, onClose }: LibraryDetailDialogProps) {
  const qc = useQueryClient()

  const { data: library } = useQuery({
    queryKey: ['library', libraryId],
    queryFn:  () => libraryApi.getById(libraryId),
  })

  // Source upgrades from this client's catalog (per-client + globals)
  const { data: upgrades = [] } = useQuery({
    queryKey: ['custom-upgrades', clientId],
    queryFn:  () => customUpgradeApi.getForClient(clientId),
  })

  const [selectedToAdd, setSelectedToAdd] = useState<string>('')

  const addMutation = useMutation({
    mutationFn: (upgradeId: number) => libraryApi.addUpgrade(libraryId, upgradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library', libraryId] })
      qc.invalidateQueries({ queryKey: ['libraries', clientId] })
      setSelectedToAdd('')
      toast.success('Upgrade added to library')
    },
    onError: () => toast.error('Failed to add upgrade'),
  })

  const removeMutation = useMutation({
    mutationFn: (upgradeId: number) => libraryApi.removeUpgrade(libraryId, upgradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library', libraryId] })
      qc.invalidateQueries({ queryKey: ['libraries', clientId] })
      toast.success('Upgrade removed from library')
    },
    onError: () => toast.error('Failed to remove upgrade'),
  })

  if (!library) return null

  const bakedIds = new Set(library.bakedInUpgrades.map(u => u.id))
  const available = upgrades.filter(u => !bakedIds.has(u.id))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{library.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {library.description && (
            <p className="text-sm text-muted-foreground">{library.description}</p>
          )}

          <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between">
            {library.originalFileName ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{library.originalFileName}</span>
                  <span className="text-xs text-muted-foreground">
                    ({fmtBytes(library.contentLength)})
                  </span>
                </div>
                <a
                  href={libraryApi.pdfUrl(library.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open PDF <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                <FileText className="h-4 w-4" />
                No PDF uploaded yet — edit this library to add one.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Baked-in Upgrades</h4>
            <p className="text-xs text-muted-foreground">
              These upgrades are pre-toggled ON for any new proposal that uses this library.
            </p>

            {library.bakedInUpgrades.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No baked-in upgrades.</p>
            ) : (
              <div className="space-y-1">
                {library.bakedInUpgrades.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded border bg-card px-2 py-1.5"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{u.name}</span>
                      {u.isGlobal && (
                        <span className="ml-1.5 rounded bg-blue-100 text-blue-800 px-1 text-[10px]">
                          GLOBAL
                        </span>
                      )}
                      {u.description && (
                        <span className="text-xs text-muted-foreground ml-2">{u.description}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => removeMutation.mutate(u.id)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {available.length > 0 && (
              <div className="flex gap-2 pt-2">
                <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder="Add an upgrade…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} {u.isGlobal && '(global)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedToAdd || addMutation.isPending}
                  onClick={() => addMutation.mutate(Number(selectedToAdd))}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
