import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Paperclip, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  cannedResponseApi,
  type CannedResponse,
  type CannedResponseAttachment,
  type CannedResponseInput,
} from '@/api/cannedResponses'

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const emptyForm: CannedResponseInput = {
  categoryId: 0,
  name:       '',
  subject:    '',
  bodyHtml:   '',
  defaultTo:  '',
  defaultCc:  '',
  defaultBcc: '',
}

export function CannedResponsesPanel() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['canned-response-categories'],
    queryFn:  cannedResponseApi.listCategories,
  })
  const { data: responses = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn:  cannedResponseApi.list,
  })

  const [addCatOpen, setAddCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const createCat = useMutation({
    mutationFn: () => cannedResponseApi.createCategory({ name: newCatName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-response-categories'] })
      setNewCatName(''); setAddCatOpen(false)
    },
    onError: () => toast.error('Failed to create category'),
  })
  const deleteCat = useMutation({
    mutationFn: (id: number) => cannedResponseApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-response-categories'] })
      qc.invalidateQueries({ queryKey: ['canned-responses'] })
    },
    onError: () => toast.error('Failed to delete category'),
  })

  const [formOpen, setFormOpen]     = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [form, setForm]             = useState<CannedResponseInput>(emptyForm)
  const [editingAttachments, setEditingAttachments] =
    useState<CannedResponseAttachment[]>([])
  const [expandedCat, setExpandedCat] = useState<number | null>(null)

  function openNew(categoryId: number) {
    setEditingId(null)
    setForm({ ...emptyForm, categoryId })
    setEditingAttachments([])
    setFormOpen(true)
  }

  function openEdit(r: CannedResponse) {
    setEditingId(r.id)
    setForm({
      categoryId: r.categoryId,
      name:       r.name,
      subject:    r.subject ?? '',
      bodyHtml:   r.bodyHtml,
      defaultTo:  r.defaultTo  ?? '',
      defaultCc:  r.defaultCc  ?? '',
      defaultBcc: r.defaultBcc ?? '',
    })
    setEditingAttachments(r.attachments)
    setFormOpen(true)
  }

  const saveMut = useMutation({
    mutationFn: () => editingId
      ? cannedResponseApi.update(editingId, form)
      : cannedResponseApi.create(form),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['canned-responses'] })
      qc.invalidateQueries({ queryKey: ['canned-response-categories'] })
      // If this was a new response, switch into edit mode so the user can attach files.
      if (!editingId) {
        setEditingId(saved.id)
        setEditingAttachments(saved.attachments)
      }
      toast.success(editingId ? 'Response updated' : 'Response created')
    },
    onError: () => toast.error('Save failed'),
  })

  const deleteResp = useMutation({
    mutationFn: (id: number) => cannedResponseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses'] })
      qc.invalidateQueries({ queryKey: ['canned-response-categories'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const uploadAtt = useMutation({
    mutationFn: (file: File) => {
      if (!editingId) throw new Error('Save the response before attaching files.')
      return cannedResponseApi.uploadAttachment(editingId, file)
    },
    onSuccess: (att) => {
      setEditingAttachments((curr) => [...curr, att])
      qc.invalidateQueries({ queryKey: ['canned-responses'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    },
  })

  const deleteAtt = useMutation({
    mutationFn: (attachmentId: number) => cannedResponseApi.deleteAttachment(attachmentId),
    onSuccess: (_data, attachmentId) => {
      setEditingAttachments((curr) => curr.filter((a) => a.id !== attachmentId))
      qc.invalidateQueries({ queryKey: ['canned-responses'] })
    },
    onError: () => toast.error('Failed to remove attachment'),
  })

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('Attachment exceeds the 25 MB limit.')
      return
    }
    uploadAtt.mutate(file)
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Canned Responses</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-written email templates organized by category. All responses are shared with everyone in the organization.
          </p>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className="border rounded-md">
          <button
            onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span>{cat.name} ({cat.responseCount})</span>
            <div className="flex items-center gap-1">
              <button onClick={e => { e.stopPropagation(); openNew(cat.id) }}
                className="p-1 rounded hover:bg-muted" title="Add response">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); deleteCat.mutate(cat.id) }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete category">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expandedCat === cat.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>
          {expandedCat === cat.id && (
            <div className="border-t divide-y">
              {responses.filter(r => r.categoryId === cat.id).map(r => (
                <div key={r.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    {r.subject && <span className="ml-1.5 text-xs text-muted-foreground">({r.subject})</span>}
                    {r.attachments.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" /> {r.attachments.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => deleteResp.mutate(r.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
              {responses.filter(r => r.categoryId === cat.id).length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No responses in this category.</p>
              )}
            </div>
          )}
        </div>
      ))}

      {addCatOpen ? (
        <div className="flex items-center gap-2">
          <Input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name"
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" onClick={() => createCat.mutate()} disabled={!newCatName.trim()}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAddCatOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAddCatOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Category
        </Button>
      )}

      {formOpen && (
        <div className="border rounded-md p-4 space-y-3 bg-muted/20">
          <h4 className="text-sm font-semibold">{editingId ? 'Edit Response' : 'New Response'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select
                value={form.categoryId}
                onChange={e => setForm({ ...form, categoryId: Number(e.target.value) })}
                className="w-full h-8 text-sm border border-border rounded px-2 bg-transparent"
              >
                <option value={0} disabled>Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Subject (optional)</Label>
            <Input
              value={form.subject ?? ''}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="h-8 text-sm"
              placeholder="Auto-fills subject line"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Default To</Label>
              <Input
                value={form.defaultTo ?? ''}
                onChange={e => setForm({ ...form, defaultTo: e.target.value })}
                className="h-8 text-sm"
                placeholder="comma-separated"
              />
            </div>
            <div>
              <Label className="text-xs">Default Cc</Label>
              <Input
                value={form.defaultCc ?? ''}
                onChange={e => setForm({ ...form, defaultCc: e.target.value })}
                className="h-8 text-sm"
                placeholder="comma-separated"
              />
            </div>
            <div>
              <Label className="text-xs">Default Bcc</Label>
              <Input
                value={form.defaultBcc ?? ''}
                onChange={e => setForm({ ...form, defaultBcc: e.target.value })}
                className="h-8 text-sm"
                placeholder="comma-separated"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <div className="mt-1">
              <RichTextEditor
                value={form.bodyHtml}
                onChange={html => setForm(f => ({ ...f, bodyHtml: html }))}
                placeholder="Write your canned response…"
                minHeight="140px"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!editingId || uploadAtt.isPending}
                title={editingId ? 'Attach a file' : 'Save the response first to add attachments'}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1" />
                {uploadAtt.isPending ? 'Uploading…' : 'Add file'}
              </Button>
            </div>
            {!editingId && (
              <p className="text-xs text-muted-foreground">Save the response first, then attach files (max 25 MB each).</p>
            )}
            {editingAttachments.length > 0 && (
              <ul className="border rounded-md divide-y bg-background">
                {editingAttachments.map(att => (
                  <li key={att.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{att.fileName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(att.fileSize)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={cannedResponseApi.attachmentDownloadUrl(att.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-muted"
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => deleteAtt.mutate(att.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Remove attachment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={!form.name.trim() || !form.categoryId || saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}
