import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, Trash2, Eye, EyeOff, Paperclip, X,
  AlertTriangle, Clock, Lock, User, Tag, FolderKanban,
  CalendarDays, MessageSquare, Plus, Download, Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ticketApi, ticketCategoryApi, ticketStatusApi,
  type UpdateTicketRequest, type TicketDetail, type TicketHistory,
} from '@/api/tickets'
import { allProjectsApi } from '@/api/clients'
import { workspaceApi } from '@/api/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { EmailNotesPanel } from '@/components/email/EmailNotesPanel'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  Medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  Low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditTicketDialog({
  ticket, open, onClose,
}: {
  ticket:  TicketDetail
  open:    boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['ticket-categories'], queryFn: ticketCategoryApi.getAll })
  const { data: statuses   = [] } = useQuery({ queryKey: ['ticket-statuses'],   queryFn: ticketStatusApi.getAll })
  const { data: projects   = [] } = useQuery({ queryKey: ['all-projects'],      queryFn: () => allProjectsApi.getAll() })
  const { data: users      = [] } = useQuery({ queryKey: ['workspace-users'],   queryFn: () => workspaceApi.getUsers() })

  const [form, setForm] = useState<UpdateTicketRequest>({
    title:                ticket.title,
    description:          ticket.description,
    priority:             ticket.priority,
    categoryId:           ticket.categoryId,
    statusId:             ticket.statusId,
    assignedToEmail:      ticket.assignedToEmail,
    projectId:            ticket.projectId,
    linkedEmailMessageId: ticket.linkedEmailMessageId,
    dueDate:              ticket.dueDate ? ticket.dueDate.slice(0, 10) : null,
  })

  const update = useMutation({
    mutationFn: () => ticketApi.update(ticket.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket updated')
      onClose()
    },
    onError: () => toast.error('Failed to update ticket'),
  })

  function set<K extends keyof UpdateTicketRequest>(k: K, v: UpdateTicketRequest[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={String(form.statusId)} onValueChange={v => set('statusId', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId?.toString() ?? 'none'}
                onValueChange={v => set('categoryId', v === 'none' ? null : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate ?? ''}
                onChange={e => set('dueDate', e.target.value || null)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select
                value={form.assignedToEmail ?? 'none'}
                onValueChange={v => set('assignedToEmail', v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={form.projectId?.toString() ?? 'none'}
                onValueChange={v => set('projectId', v === 'none' ? null : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.clientName ? ` (${p.clientName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => update.mutate()} disabled={!form.title.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Comment section ───────────────────────────────────────────────────────────

function CommentThread({ ticket }: { ticket: TicketDetail }) {
  const qc               = useQueryClient()
  const [body, setBody]  = useState('')
  const [priv, setPriv]  = useState(true)
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null)

  const add = useMutation({
    mutationFn: () => ticketApi.addComment(ticket.id, { body, isPrivate: priv }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      setBody('')
      setPriv(true)
    },
    onError: () => toast.error('Failed to add comment'),
  })

  const updateComment = useMutation({
    mutationFn: ({ id, b }: { id: number; b: string }) =>
      ticketApi.updateComment(ticket.id, id, { body: b }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      setEditing(null)
    },
    onError: () => toast.error('Failed to update comment'),
  })

  const deleteComment = useMutation({
    mutationFn: (id: number) => ticketApi.deleteComment(ticket.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
    onError:   () => toast.error('Failed to delete comment'),
  })

  return (
    <div className="space-y-4">
      {ticket.comments.map(c => (
        <div
          key={c.id}
          className={cn(
            'rounded-md border border-border p-3 text-sm',
            c.isDeleted  && 'opacity-50',
            c.isPrivate  && !c.isDeleted && 'border-dashed bg-amber-50/30 dark:bg-amber-950/10',
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.authorEmail}</span>
              <span>·</span>
              <span>{formatDateTime(c.createdAt)}</span>
              {c.updatedAt && <span className="italic">(edited)</span>}
              {c.isPrivate && !c.isDeleted && (
                <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" /> Private
                </span>
              )}
            </div>
            {!c.isDeleted && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing({ id: c.id, body: c.body })}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this comment?')) deleteComment.mutate(c.id)
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {editing?.id === c.id ? (
            <div className="space-y-2 mt-2">
              <Textarea
                value={editing.body}
                onChange={e => setEditing(ed => ed ? { ...ed, body: e.target.value } : null)}
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateComment.mutate({ id: c.id, b: editing.body })}
                  disabled={updateComment.isPending}
                >
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
          )}
        </div>
      ))}

      {/* New comment form */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Textarea
          placeholder="Add a comment… use @email@domain.com to mention someone"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPriv(v => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors',
              priv
                ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                : 'text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {priv ? <Lock className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {priv ? 'Private' : 'Make private'}
          </button>
          <Button
            size="sm"
            onClick={() => add.mutate()}
            disabled={!body.trim() || add.isPending}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            {add.isPending ? 'Posting…' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ ticketId }: { ticketId: number }) {
  const { data = [] } = useQuery({
    queryKey: ['ticket-history', ticketId],
    queryFn:  () => ticketApi.getHistory(ticketId),
  })

  if (!data.length)
    return <p className="text-sm text-muted-foreground py-4">No history yet</p>

  return (
    <ul className="space-y-2 text-sm">
      {data.map((h: TicketHistory) => (
        <li key={h.id} className="flex items-start gap-3 text-xs">
          <span className="text-muted-foreground/50 mt-0.5 shrink-0">{formatDateTime(h.changedAt)}</span>
          <span>
            <span className="font-medium">{h.changedByEmail}</span>{' '}
            changed <span className="font-medium">{h.fieldChanged}</span>
            {h.oldValue && <> from <span className="text-muted-foreground">"{h.oldValue}"</span></>}
            {h.newValue && <> to <span className="text-muted-foreground">"{h.newValue}"</span></>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Attachments ───────────────────────────────────────────────────────────────

function AttachmentsPanel({ ticket }: { ticket: TicketDetail }) {
  const qc       = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => ticketApi.uploadAttachment(ticket.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      toast.success('File uploaded')
    },
    onError: (e: Error) => toast.error(e.message || 'Upload failed'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => ticketApi.deleteAttachment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
    onError:   () => toast.error('Failed to delete attachment'),
  })

  return (
    <div className="space-y-2">
      {ticket.attachments.map(a => (
        <div
          key={a.id}
          className="flex items-center gap-3 px-3 py-2 rounded-md border border-border text-sm"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{a.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(a.fileSize)} · {a.uploadedByEmail}</p>
          </div>
          <a
            href={ticketApi.getAttachmentUrl(a.id)}
            target="_blank"
            rel="noreferrer"
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => {
              if (confirm('Delete this attachment?')) remove.mutate(a.id)
            }}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) upload.mutate(f)
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        {upload.isPending ? 'Uploading…' : 'Attach File'}
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveTab = 'comments' | 'history' | 'attachments' | 'email-notes'

export default function TicketDetailPage() {
  const { id }         = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const qc             = useQueryClient()
  const [editOpen, setEditOpen]   = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('comments')

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ['ticket', Number(id)],
    queryFn:  () => ticketApi.getById(Number(id)),
    enabled:  !!id,
  })

  const { data: allStatuses = [] } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn:  ticketStatusApi.getAll,
  })

  const changeStatus = useMutation({
    mutationFn: (newStatusId: number) => {
      if (!ticket) return Promise.reject(new Error('No ticket'))
      return ticketApi.update(ticket.id, {
        title:                ticket.title,
        description:          ticket.description,
        priority:             ticket.priority,
        categoryId:           ticket.categoryId,
        statusId:             newStatusId,
        assignedToEmail:      ticket.assignedToEmail,
        projectId:            ticket.projectId,
        linkedEmailMessageId: ticket.linkedEmailMessageId,
        dueDate:              ticket.dueDate ? ticket.dueDate.slice(0, 10) : null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', Number(id)] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deleteTicket = useMutation({
    mutationFn: () => ticketApi.delete(Number(id)),
    onSuccess: () => {
      toast.success('Ticket deleted')
      navigate('/tickets')
    },
    onError: () => toast.error('You do not have permission to delete this ticket'),
  })

  const watch = useMutation({
    mutationFn: () => ticketApi.watch(Number(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', Number(id)] }),
  })
  const unwatch = useMutation({
    mutationFn: () => ticketApi.unwatch(Number(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', Number(id)] }),
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !ticket) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Ticket not found.</p>
      </div>
    )
  }

  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'comments',    label: 'Comments',    count: ticket.comments.length },
    { id: 'history',     label: 'History'                                     },
    { id: 'attachments', label: 'Attachments', count: ticket.attachments.length },
    ...(ticket.linkedEmailMessageId
      ? [{ id: 'email-notes' as ActiveTab, label: 'Email Notes' }]
      : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => ticket.isWatching ? unwatch.mutate() : watch.mutate()}
            disabled={watch.isPending || unwatch.isPending}
          >
            {ticket.isWatching ? (
              <><Eye className="h-3.5 w-3.5 mr-1.5" />Watching</>
            ) : (
              <><EyeOff className="h-3.5 w-3.5 mr-1.5" />Watch</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 border-red-200 dark:border-red-900"
            onClick={() => {
              if (confirm('Delete this ticket? This cannot be undone.')) deleteTicket.mutate()
            }}
            disabled={deleteTicket.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title + number */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">{ticket.ticketNumber}</span>
              <Select
                value={String(ticket.statusId)}
                onValueChange={v => changeStatus.mutate(Number(v))}
                disabled={changeStatus.isPending}
              >
                <SelectTrigger
                  className="h-6 w-auto min-w-0 gap-1 rounded px-2 py-0.5 text-[11px] font-medium border-0 focus:ring-1 focus:ring-ring"
                  style={{ backgroundColor: ticket.statusColor + '22', color: ticket.statusColor }}
                >
                  <SelectValue>{ticket.statusName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ticket.isOverdue && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overdue
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold">{ticket.title}</h1>
            {ticket.description && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
            )}
          </div>

          {/* Tab strip */}
          <div className="flex items-center gap-1 border-b border-border -mx-6 px-6">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === t.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded px-1 py-0.5">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'comments'    && <CommentThread ticket={ticket} />}
          {activeTab === 'history'     && <HistoryTab ticketId={ticket.id} />}
          {activeTab === 'attachments' && <AttachmentsPanel ticket={ticket} />}
          {activeTab === 'email-notes' && ticket.linkedEmailMessageId && (
            <div className="rounded-md border border-border overflow-hidden">
              <EmailNotesPanel
                messageId={ticket.linkedEmailMessageId}
                variant="inline"
              />
            </div>
          )}
        </div>

        {/* Sidebar metadata */}
        <aside className="w-64 shrink-0 border-l border-border overflow-y-auto px-4 py-5 space-y-5 bg-muted/10">
          <MetaRow icon={Tag} label="Priority">
            <span className={cn('inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none', PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.Low)}>
              {ticket.priority}
            </span>
          </MetaRow>

          <MetaRow icon={Tag} label="Category">
            {ticket.categoryName ? (
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-none"
                style={{ backgroundColor: ticket.categoryColor + '22', color: ticket.categoryColor ?? undefined }}
              >
                {ticket.categoryName}
              </span>
            ) : <span className="text-muted-foreground text-xs">None</span>}
          </MetaRow>

          <MetaRow icon={User} label="Assigned To">
            <span className="text-xs break-all">{ticket.assignedToEmail ?? <span className="text-muted-foreground italic">Unassigned</span>}</span>
          </MetaRow>

          <MetaRow icon={FolderKanban} label="Project">
            <span className="text-xs">{ticket.projectName ?? <span className="text-muted-foreground italic">None</span>}</span>
          </MetaRow>

          <MetaRow icon={CalendarDays} label="Due Date">
            <span className={cn('text-xs', ticket.isOverdue && 'text-red-500')}>
              {ticket.dueDate ? formatDate(ticket.dueDate) : <span className="text-muted-foreground italic">None</span>}
            </span>
          </MetaRow>

          {ticket.linkedEmailMessageId && (
            <MetaRow icon={Mail} label="Linked Email">
              <button
                onClick={() => navigate(`/emails?select=${encodeURIComponent(ticket.linkedEmailMessageId!)}`)}
                className="text-xs text-primary hover:underline text-left leading-snug"
              >
                View in Email
              </button>
            </MetaRow>
          )}

          <MetaRow icon={Clock} label="Created">
            <span className="text-xs">{formatDate(ticket.createdAt)}</span>
          </MetaRow>

          <MetaRow icon={Clock} label="Updated">
            <span className="text-xs">{formatDate(ticket.updatedAt)}</span>
          </MetaRow>

          {ticket.closedAt && (
            <MetaRow icon={Clock} label="Closed">
              <span className="text-xs">{formatDate(ticket.closedAt)}</span>
            </MetaRow>
          )}

          {/* Watchers */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Watchers</p>
            {ticket.watchers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">None</p>
            ) : (
              <ul className="space-y-1">
                {ticket.watchers.map(w => (
                  <li key={w.userEmail} className="text-xs truncate">{w.userEmail}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Edit dialog */}
      {editOpen && (
        <EditTicketDialog
          ticket={ticket}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sidebar metadata row helper ───────────────────────────────────────────────

function MetaRow({
  icon: Icon, label, children,
}: {
  icon:     React.ElementType
  label:    string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  )
}
