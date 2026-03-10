import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { clientApi, contactApi, type Client } from '@/api/clients'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(address: string): string {
  const at = address.indexOf('@')
  return at >= 0 ? address.slice(at + 1).toLowerCase() : ''
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function AddContactForm({
  clients,
  defaultName,
  defaultEmail,
  defaultClientId,
  onSuccess,
}: {
  clients:         Client[]
  defaultName:     string
  defaultEmail:    string
  defaultClientId: number | null
  onSuccess:       () => void
}) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState<number | null>(defaultClientId)
  const [name, setName]         = useState(defaultName)
  const [email, setEmail]       = useState(defaultEmail)
  const [title, setTitle]       = useState('')
  const [phone, setPhone]       = useState('')

  const mutation = useMutation({
    mutationFn: () => contactApi.create(clientId!, { name, email, phone, title, isPrimary: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Contact added.')
      onSuccess()
    },
    onError: () => toast.error('Failed to add contact.'),
  })

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Client</Label>
        <select
          value={clientId ?? ''}
          onChange={e => setClientId(Number(e.target.value) || null)}
          className="w-full text-sm rounded border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Select a client…</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input className="h-8 text-sm" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input className="h-8 text-sm" value={email} onChange={e => setEmail(e.target.value)} type="email" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input className="h-8 text-sm" value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input className="h-8 text-sm" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!clientId || !name.trim() || !email.trim() || mutation.isPending}
        >
          Add Contact
        </Button>
      </DialogFooter>
    </div>
  )
}

function AddClientForm({
  defaultName,
  defaultDomain,
  onSuccess,
}: {
  defaultName:   string
  defaultDomain: string
  onSuccess:     () => void
}) {
  const qc = useQueryClient()
  const [name, setName]     = useState(defaultName)
  const [domain, setDomain] = useState(defaultDomain)

  const mutation = useMutation({
    mutationFn: () => clientApi.create({
      name, domain,
      description: '', status: 'Active', industry: '',
      website: '', street: '', city: '', state: '', zip: '',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client added.')
      onSuccess()
    },
    onError: () => toast.error('Failed to add client.'),
  })

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Company Name</Label>
        <Input className="h-8 text-sm" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Domain</Label>
        <Input className="h-8 text-sm" value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" />
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
        >
          Add Client
        </Button>
      </DialogFooter>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AddToBosButtonProps {
  address: string
  name:    string
  clients: Client[]
}

type Mode = 'contact' | 'client'

export function AddToBosButton({ address, name, clients }: AddToBosButtonProps) {
  const [open, setOpen] = useState(false)
  const domain          = extractDomain(address)
  const matchedClient   = clients.find(c => c.domain && c.domain.toLowerCase() === domain)

  const defaultMode: Mode = matchedClient ? 'contact' : 'client'
  const [mode, setMode]   = useState<Mode>(defaultMode)

  function handleOpen() {
    setMode(defaultMode)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Add ${address} to BOS`}
        className="inline-flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <UserPlus className="h-3 w-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to BOS</DialogTitle>
          </DialogHeader>

          {/* Address summary */}
          <div className="text-xs bg-muted rounded px-3 py-2 space-y-0.5">
            {name && <p className="font-medium text-foreground">{name}</p>}
            <p className="text-muted-foreground">{address}</p>
            {domain && matchedClient && (
              <p className="text-muted-foreground">
                @{domain} matches{' '}
                <span className="font-medium text-foreground">{matchedClient.name}</span>
              </p>
            )}
            {domain && !matchedClient && (
              <p className="text-muted-foreground">@{domain} — no matching client</p>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['contact', 'client'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'text-xs px-3 py-1 rounded border transition-colors capitalize',
                  mode === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground',
                )}
              >
                Add as {m}
              </button>
            ))}
          </div>

          {mode === 'contact' && (
            <AddContactForm
              clients={clients}
              defaultName={name}
              defaultEmail={address}
              defaultClientId={matchedClient?.id ?? null}
              onSuccess={() => setOpen(false)}
            />
          )}

          {mode === 'client' && (
            <AddClientForm
              defaultName={name || domain}
              defaultDomain={domain}
              onSuccess={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
