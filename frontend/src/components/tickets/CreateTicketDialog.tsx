import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Mail, Search, X, FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import {
  ticketApi, ticketCategoryApi, ticketStatusApi,
  type CreateTicketRequest,
} from '@/api/tickets'
import { allProjectsApi } from '@/api/clients'
import { gmailApi, type EmailSummary } from '@/api/gmail'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

// ── Email search picker ───────────────────────────────────────────────────────

function EmailSearchPicker({
  value,
  subject,
  onChange,
}: {
  value:    string | null
  subject:  string | null
  onChange: (messageId: string | null, subject: string | null) => void
}) {
  const [input, setInput]         = useState('')
  const [query, setQuery]         = useState('')
  const [open, setOpen]           = useState(false)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    debounceRef.current && clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(input.trim()), 400)
    return () => { debounceRef.current && clearTimeout(debounceRef.current) }
  }, [input])

  const { data, isFetching } = useQuery({
    queryKey: ['email-search-picker', query],
    queryFn:  () => gmailApi.listEmails({ q: query, maxResults: 8 }),
    enabled:  query.length >= 2,
    staleTime: 30_000,
  })

  const emails: EmailSummary[] = data?.emails ?? []

  function select(email: EmailSummary) {
    onChange(email.rfcMessageId ?? email.messageId, email.subject)
    setInput('')
    setQuery('')
    setOpen(false)
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">{subject ?? value}</span>
        <button onClick={() => onChange(null, null)} className="shrink-0 hover:text-blue-900 dark:hover:text-blue-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-8 h-8 text-sm"
        placeholder="Search emails by subject, sender…"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : emails.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No emails found</p>
          ) : (
            emails.map(e => (
              <button
                key={e.messageId}
                onMouseDown={() => select(e)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
              >
                <p className="font-medium truncate">{e.subject || '(no subject)'}</p>
                <p className="text-muted-foreground truncate">{e.fromName || e.fromAddress} · {new Date(e.receivedAt).toLocaleDateString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  open:    boolean
  onClose: () => void
  /** Pre-fill values — any can be omitted or empty-string to mean "not set" */
  prefill?: {
    title?:               string
    linkedEmailMessageId?: string
    linkedEmailSubject?:  string
    projectId?:           number
  }
  /** Whether to navigate to the new ticket after creation */
  navigate?: boolean
}

export function CreateTicketDialog({ open, onClose, prefill, navigate: shouldNavigate = true }: Props) {
  const qc       = useQueryClient()
  const nav      = useNavigate()

  const { data: categories = [] } = useQuery({ queryKey: ['ticket-categories'], queryFn: ticketCategoryApi.getAll })
  const { data: statuses   = [] } = useQuery({ queryKey: ['ticket-statuses'],   queryFn: ticketStatusApi.getAll })
  const { data: projects   = [] } = useQuery({ queryKey: ['all-projects'], queryFn: () => allProjectsApi.getAll() })

  const [form, setForm] = useState<CreateTicketRequest>(() => ({
    title:                prefill?.title ?? '',
    description:          '',
    priority:             'Medium',
    categoryId:           null,
    statusId:             null,
    assignedToEmail:      null,
    projectId:            prefill?.projectId ?? null,
    linkedEmailMessageId: prefill?.linkedEmailMessageId || null,
    dueDate:              null,
  }))
  // Track linked email subject for display (not sent to server)
  const [linkedEmailSubject, setLinkedEmailSubject] = useState<string | null>(
    prefill?.linkedEmailSubject ?? null
  )

  // Sync prefill when it changes (e.g. user opens dialog for different emails)
  const prefillKey = prefill?.linkedEmailMessageId ?? ''
  const [lastPrefillKey, setLastPrefillKey] = useState(prefillKey)
  if (prefillKey !== lastPrefillKey) {
    setLastPrefillKey(prefillKey)
    setForm({
      title:                prefill?.title ?? '',
      description:          '',
      priority:             'Medium',
      categoryId:           null,
      statusId:             null,
      assignedToEmail:      null,
      projectId:            prefill?.projectId ?? null,
      linkedEmailMessageId: prefill?.linkedEmailMessageId || null,
      dueDate:              null,
    })
    setLinkedEmailSubject(prefill?.linkedEmailSubject ?? null)
  }

  // Per-click navigation choice. When the dialog is launched from an email view we
  // expose two buttons ("Create & Stay" / "Create & Open Ticket"); the chosen value
  // is recorded here so the mutation's onSuccess can read it without re-rendering.
  const navigateAfterRef = useRef<boolean>(shouldNavigate)

  const create = useMutation({
    mutationFn: () => ticketApi.create(form),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['email-tickets'] })
      toast.success(`${ticket.ticketNumber} created`)
      onClose()
      if (navigateAfterRef.current) nav(`/tickets/${ticket.id}`)
    },
    onError: () => toast.error('Failed to create ticket'),
  })

  function submit(navigateAfter: boolean) {
    navigateAfterRef.current = navigateAfter
    create.mutate()
  }

  const fromEmail = !!prefill?.linkedEmailMessageId

  function set<K extends keyof CreateTicketRequest>(k: K, v: CreateTicketRequest[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Brief summary of the issue"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Detailed description…"
            />
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.statusId?.toString() ?? 'default'}
                onValueChange={v => set('statusId', v === 'default' ? null : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {statuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate?.slice(0, 10) ?? ''}
                onChange={e => set('dueDate', e.target.value || null)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign To (email)</Label>
              <Input
                type="email"
                value={form.assignedToEmail ?? ''}
                onChange={e => set('assignedToEmail', e.target.value || null)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" /> Project
              </Label>
              <Select
                value={form.projectId?.toString() ?? 'none'}
                onValueChange={v => set('projectId', v === 'none' ? null : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {p.clientName ? ` (${p.clientName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Linked Email
            </Label>
            <EmailSearchPicker
              value={form.linkedEmailMessageId}
              subject={linkedEmailSubject}
              onChange={(id, subject) => {
                set('linkedEmailMessageId', id)
                setLinkedEmailSubject(subject)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {fromEmail ? (
            <>
              <Button
                variant="outline"
                onClick={() => submit(false)}
                disabled={!form.title.trim() || create.isPending}
              >
                {create.isPending ? 'Creating…' : 'Create & Stay on Email'}
              </Button>
              <Button
                onClick={() => submit(true)}
                disabled={!form.title.trim() || create.isPending}
              >
                {create.isPending ? 'Creating…' : 'Create & Open Ticket'}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => submit(shouldNavigate)}
              disabled={!form.title.trim() || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create Ticket'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
