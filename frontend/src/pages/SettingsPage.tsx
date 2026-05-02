import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, Plus, Pencil, Trash2, Check, X, Wrench } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdobeSettings, useClearAdobeCredentials } from '@/hooks/useAdobeSettings'
import ConnectAdobeModal from '@/components/settings/ConnectAdobeModal'
import { CannedResponsesPanel } from '@/components/settings/CannedResponsesPanel'
import { EmailSignaturesPanel } from '@/components/settings/EmailSignaturesPanel'
import { quickBooksApi } from '@/api/projects'
import {
  ticketCategoryApi, ticketStatusApi,
  type TicketCategory, type TicketStatus,
  type CreateTicketCategoryRequest, type UpdateTicketCategoryRequest,
  type CreateTicketStatusRequest, type UpdateTicketStatusRequest,
} from '@/api/tickets'

// ── Ticket Categories Panel ───────────────────────────────────────────────────

function TicketCategoriesPanel() {
  const qc = useQueryClient()
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn:  ticketCategoryApi.getAll,
  })

  const [addForm, setAddForm]   = useState<CreateTicketCategoryRequest>({ name: '', color: '#6366f1' })
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UpdateTicketCategoryRequest>({ name: '', color: '#6366f1' })

  const create = useMutation({
    mutationFn: () => ticketCategoryApi.create(addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-categories'] })
      setAddForm({ name: '', color: '#6366f1' })
      setAdding(false)
    },
    onError: () => toast.error('Failed to create category'),
  })

  const update = useMutation({
    mutationFn: ({ id }: { id: number }) => ticketCategoryApi.update(id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-categories'] })
      setEditId(null)
    },
    onError: () => toast.error('Failed to update category'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => ticketCategoryApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-categories'] }),
    onError:   () => toast.error('Failed to delete category'),
  })

  function startEdit(c: TicketCategory) {
    setEditId(c.id)
    setEditForm({ name: c.name, color: c.color })
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Ticket Categories</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Group tickets by type (e.g. Bug, Feature Request, Support).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Category
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex items-end gap-2 p-3 rounded-md border border-dashed border-border bg-muted/20">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-8 text-sm"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Category name"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <input
              type="color"
              value={addForm.color}
              onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
              className="h-8 w-10 rounded border border-border cursor-pointer"
            />
          </div>
          <Button size="sm" onClick={() => create.mutate()} disabled={!addForm.name.trim() || create.isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No categories yet.</p>
      ) : (
        <div className="space-y-1">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
              {editId === c.id ? (
                <>
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                    className="h-7 w-8 rounded border border-border cursor-pointer shrink-0"
                  />
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                  <button
                    onClick={() => update.mutate({ id: c.id })}
                    disabled={!editForm.name.trim() || update.isPending}
                    className="h-7 w-7 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-sm">{c.name}</span>
                  <button
                    onClick={() => startEdit(c)}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete category "${c.name}"?`)) remove.mutate(c.id) }}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Ticket Statuses Panel ─────────────────────────────────────────────────────

function TicketStatusesPanel() {
  const qc = useQueryClient()
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn:  ticketStatusApi.getAll,
  })

  const [adding, setAdding]     = useState(false)
  const [addForm, setAddForm]   = useState<CreateTicketStatusRequest>({
    name: '', color: '#6366f1', isDefault: false, isClosed: false,
  })
  const [editId, setEditId]     = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UpdateTicketStatusRequest>({
    name: '', color: '#6366f1', isDefault: false, isClosed: false, displayOrder: 0,
  })

  const create = useMutation({
    mutationFn: () => ticketStatusApi.create(addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-statuses'] })
      setAddForm({ name: '', color: '#6366f1', isDefault: false, isClosed: false })
      setAdding(false)
    },
    onError: () => toast.error('Failed to create status'),
  })

  const update = useMutation({
    mutationFn: ({ id }: { id: number }) => ticketStatusApi.update(id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-statuses'] })
      setEditId(null)
    },
    onError: () => toast.error('Failed to update status'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => ticketStatusApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-statuses'] }),
    onError:   () => toast.error('Cannot delete a status that is in use'),
  })

  function startEdit(s: TicketStatus) {
    setEditId(s.id)
    setEditForm({ name: s.name, color: s.color, isDefault: s.isDefault, isClosed: s.isClosed, displayOrder: s.displayOrder })
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`h-6 px-2 rounded text-[10px] font-semibold border transition-colors ${
          value
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:bg-muted'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Ticket Statuses</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define the workflow stages for tickets. Mark one as Default (assigned to new tickets) and at least one as Closed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Status
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex items-end gap-2 p-3 rounded-md border border-dashed border-border bg-muted/20">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-8 text-sm"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Status name"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <input
              type="color"
              value={addForm.color}
              onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
              className="h-8 w-10 rounded border border-border cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1 pb-0.5">
            <Toggle value={addForm.isDefault} onChange={v => setAddForm(f => ({ ...f, isDefault: v }))} label="Default" />
            <Toggle value={addForm.isClosed}  onChange={v => setAddForm(f => ({ ...f, isClosed:  v }))} label="Closed"  />
          </div>
          <Button size="sm" onClick={() => create.mutate()} disabled={!addForm.name.trim() || create.isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : statuses.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No statuses yet. Add at least one to create tickets.</p>
      ) : (
        <div className="space-y-1">
          {statuses.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
              {editId === s.id ? (
                <>
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                    className="h-7 w-8 rounded border border-border cursor-pointer shrink-0"
                  />
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <Toggle value={editForm.isDefault} onChange={v => setEditForm(f => ({ ...f, isDefault: v }))} label="Default" />
                    <Toggle value={editForm.isClosed}  onChange={v => setEditForm(f => ({ ...f, isClosed:  v }))} label="Closed"  />
                  </div>
                  <button
                    onClick={() => update.mutate({ id: s.id })}
                    disabled={!editForm.name.trim() || update.isPending}
                    className="h-7 w-7 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm">{s.name}</span>
                  <div className="flex items-center gap-1">
                    {s.isDefault && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Default</span>
                    )}
                    {s.isClosed && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Closed</span>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(s)}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete status "${s.name}"?`)) remove.mutate(s.id) }}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isAvailable }: { isAvailable: boolean }) {
  if (isAvailable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3" />
      Not Configured
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

// ── Email Notes Repair Panel ──────────────────────────────────────────────────

interface NotesRepairResult {
  scanned:  number
  resolved: number
  skipped:  number
  message:  string
}

function EmailNotesRepairPanel() {
  const [lastResult, setLastResult] = useState<NotesRepairResult | null>(null)

  const repair = useMutation({
    mutationFn: () =>
      axios.post<NotesRepairResult>('/api/admin/repair/email-notes').then(r => r.data),
    onSuccess: (res) => {
      setLastResult(res)
      if (res.resolved > 0) toast.success(`Merged ${res.resolved} note(s) under RFC Message-IDs.`)
      else                  toast.info(res.message)
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) && err.response?.status === 403
        ? 'You must be an administrator to run this.'
        : 'Repair failed.'
      toast.error(msg)
    },
  })

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Email Notes Repair
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Merges email notes that were saved under a per-user Gmail message ID back to the
            stable cross-user RFC Message-ID, so the same email shows the same notes in every
            view. Safe to run more than once.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          size="sm"
          onClick={() => repair.mutate()}
          disabled={repair.isPending}
        >
          {repair.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</>
          ) : 'Run Repair'}
        </Button>
      </div>

      {lastResult && (
        <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            Scanned <strong>{lastResult.scanned}</strong> candidate note
            {lastResult.scanned !== 1 ? 's' : ''}. Merged{' '}
            <strong className="text-foreground">{lastResult.resolved}</strong>, skipped{' '}
            <strong>{lastResult.skipped}</strong>.
          </p>
          <p>{lastResult.message}</p>
          {lastResult.skipped > 0 && (
            <p className="text-[11px]">
              Skipped notes stay intact under their original key — they couldn't be resolved
              because the author's Gmail token is missing or the message is no longer in their
              mailbox.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const { data: status, isLoading } = useAdobeSettings()
  const clearCreds = useClearAdobeCredentials()
  const [showConnectModal, setShowConnectModal] = useState(false)

  const isConnected = status?.isAvailable ?? false

  // Show toast if redirected back from QB OAuth
  const qbParam = searchParams.get('qb')
  if (qbParam === 'connected') {
    toast.success('QuickBooks connected successfully.')
  } else if (qbParam === 'error') {
    toast.error('QuickBooks connection failed. Please try again.')
  }

  const { data: qbStatus, isLoading: qbLoading } = useQuery({
    queryKey: ['qb-status'],
    queryFn:  () => quickBooksApi.getStatus(),
    staleTime: 30_000,
  })

  const disconnectMut = useMutation({
    mutationFn: () => quickBooksApi.disconnect(),
    onSuccess:  () => {
      toast.success('QuickBooks disconnected.')
      qc.invalidateQueries({ queryKey: ['qb-status'] })
    },
    onError: () => toast.error('Failed to disconnect.'),
  })

  const { data: qbAppSettings } = useQuery({
    queryKey: ['qb-app-settings'],
    queryFn:  () => quickBooksApi.getAppSettings(),
    staleTime: 60_000,
  })
  const [qbFieldName,    setQbFieldName]    = useState<string | null>(null)
  const qbFieldNameValue = qbFieldName ?? qbAppSettings?.projectCustomFieldName ?? ''

  const saveQbFieldNameMut = useMutation({
    mutationFn: () => quickBooksApi.updateAppSettings({
      projectCustomFieldName: qbFieldNameValue.trim() === '' ? null : qbFieldNameValue.trim(),
    }),
    onSuccess: () => {
      toast.success('QuickBooks settings saved.')
      qc.invalidateQueries({ queryKey: ['qb-app-settings'] })
      setQbFieldName(null)
    },
    onError: () => toast.error('Failed to save QuickBooks settings.'),
  })

  const qbFieldDirty =
    qbFieldName !== null
    && (qbAppSettings?.projectCustomFieldName ?? '') !== qbFieldNameValue.trim()

  const qbConnected = qbStatus?.connected ?? false

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure application-wide preferences and connected services.
        </p>
      </div>

      {/* Adobe PDF Services section */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Adobe PDF Services</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Used to convert complex supplier PDFs to Excel when the built-in parser
              cannot extract the data correctly.
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : status ? (
            <StatusBadge isAvailable={isConnected} />
          ) : null}
        </div>

        {/* Conversion count — shown when credentials are configured */}
        {!isLoading && isConnected && (status?.monthlyCount ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            {status!.monthlyCount} conversion{status!.monthlyCount !== 1 ? 's' : ''} completed this month.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!isLoading && (
            <Button
              variant={isConnected ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowConnectModal(true)}
            >
              {isConnected ? 'Update Credentials' : 'Configure Credentials'}
            </Button>
          )}

          {/* Remove — only shown when credentials are stored in the database */}
          {!isLoading && isConnected && status?.isPro && (
            <Button
              variant="ghost"
              size="sm"
              disabled={clearCreds.isPending}
              onClick={() => clearCreds.mutate()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {clearCreds.isPending ? 'Removing…' : 'Remove Credentials'}
            </Button>
          )}

          <a
            href="https://developer.adobe.com/document-services/docs/overview/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Get free API credentials
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Not configured help text */}
        {!isLoading && !isConnected && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Adobe PDF Services credentials are not yet configured. Click{' '}
            <strong>Configure Credentials</strong> above and enter your Client ID and
            Client Secret from the{' '}
            <a
              href="https://developer.adobe.com/console/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Adobe Developer Console
            </a>
            . Credentials are stored securely in the application database.
          </p>
        )}
      </div>

      {/* Configure modal */}
      {showConnectModal && (
        <ConnectAdobeModal onClose={() => setShowConnectModal(false)} />
      )}

      {/* Ticket Categories */}
      <TicketCategoriesPanel />

      {/* Ticket Statuses */}
      <TicketStatusesPanel />

      {/* Canned Responses */}
      <CannedResponsesPanel />

      {/* Email Signatures */}
      <EmailSignaturesPanel />

      {/* Email Notes Repair — admin-only one-off migration */}
      <EmailNotesRepairPanel />

      {/* QuickBooks section */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">QuickBooks</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect your QuickBooks Online account to sync purchase order statuses automatically.
            </p>
          </div>
          {qbLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : (
            <StatusBadge isAvailable={qbConnected} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!qbLoading && !qbConnected && (
            <Button
              size="sm"
              onClick={() => { window.location.href = '/api/quickbooks/connect' }}
            >
              Connect QuickBooks
            </Button>
          )}

          {!qbLoading && qbConnected && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disconnectMut.isPending}
              onClick={() => disconnectMut.mutate()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnectMut.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          )}

          <a
            href="https://developer.intuit.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Intuit Developer Console
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {!qbLoading && !qbConnected && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            QuickBooks is not connected. Click <strong>Connect QuickBooks</strong> above to authorise
            via Intuit OAuth. You will need a QuickBooks Online company and an Intuit Developer
            account with a configured app (Client ID and Client Secret set in{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">appsettings.json</code>).
          </p>
        )}

        {/* Project Custom Field — auto-link estimates/invoices to BOS projects */}
        <div className="border-t pt-4 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="qb-project-field" className="text-sm font-medium">
              Project Custom Field Name (optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Name of the QuickBooks Custom Field on Estimates/Invoices that stores the BOS Project ID.
              When set, any QB document whose value in this field equals the project's ID is automatically
              linked. Leave blank to disable — projects can still link documents manually.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="qb-project-field"
              value={qbFieldNameValue}
              onChange={e => setQbFieldName(e.target.value)}
              placeholder="e.g. BOS Project ID"
              className="h-9 text-sm max-w-sm"
            />
            <Button
              size="sm"
              variant={qbFieldDirty ? 'default' : 'outline'}
              disabled={!qbFieldDirty || saveQbFieldNameMut.isPending}
              onClick={() => saveQbFieldNameMut.mutate()}
            >
              {saveQbFieldNameMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Configure a custom field in QuickBooks under <em>Account &amp; Settings → Sales → Custom fields</em>.
            Enable it for both Estimates and Invoices and use the same name here.
          </p>
        </div>
      </div>
    </div>
  )
}
