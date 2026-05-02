import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Star, ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { emailSignatureApi, type EmailSignature, type SendAsAddress } from '@/api/emailSignatures'
import { useGmailAliases } from '@/hooks/useGmail'

function buildSignatureHtml(logoDataUrl: string | null, bodyHtml: string): string {
  if (!logoDataUrl) return bodyHtml
  return (
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">` +
    `<tr>` +
    `<td style="vertical-align:top;padding-right:16px">` +
    `<img src="${logoDataUrl}" alt="Logo" style="max-width:120px;max-height:120px;display:block" />` +
    `</td>` +
    `<td style="vertical-align:top">${bodyHtml}</td>` +
    `</tr>` +
    `</table>`
  )
}

function parseSignatureHtml(html: string): { logoDataUrl: string | null; bodyHtml: string } {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const logoImg = doc.querySelector('img[alt="Logo"]') as HTMLImageElement | null
    if (!logoImg || !logoImg.src.startsWith('data:image/')) {
      return { logoDataUrl: null, bodyHtml: html }
    }
    const logoDataUrl = logoImg.src
    const cells = doc.querySelectorAll('td')
    if (cells.length >= 2) {
      return { logoDataUrl, bodyHtml: cells[cells.length - 1].innerHTML }
    }
    return { logoDataUrl, bodyHtml: html }
  } catch {
    return { logoDataUrl: null, bodyHtml: html }
  }
}

export function EmailSignaturesPanel() {
  const qc = useQueryClient()
  const { data: signatures = [] } = useQuery({
    queryKey: ['email-signatures'],
    queryFn:  emailSignatureApi.list,
  })
  const { data: sendAs = [] } = useQuery<SendAsAddress[]>({
    queryKey: ['gmail-send-as'],
    queryFn:  emailSignatureApi.getSendAsAddresses,
    staleTime: 5 * 60_000,
  })
  const { data: aliases = [] } = useGmailAliases()

  const allIdentities = [
    { value: '', label: 'Personal (primary email)' },
    ...sendAs.filter(a => !a.isPrimary).map(a => ({ value: a.email, label: a.email })),
    ...aliases
      .filter(a => !sendAs.some(s => s.email === a))
      .map(a => ({ value: a, label: `${a} (alias)` })),
  ]

  const [formOpen, setFormOpen]   = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState({ aliasEmail: '', name: '', bodyHtml: '', isDefault: false })
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  function openNew() {
    setEditingId(null)
    setForm({ aliasEmail: '', name: '', bodyHtml: '', isDefault: true })
    setLogoDataUrl(null)
    setFormOpen(true)
  }

  function openEdit(s: EmailSignature) {
    setEditingId(s.id)
    const parsed = parseSignatureHtml(s.bodyHtml)
    setForm({ aliasEmail: s.aliasEmail ?? '', name: s.name, bodyHtml: parsed.bodyHtml, isDefault: s.isDefault })
    setLogoDataUrl(parsed.logoDataUrl)
    setFormOpen(true)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const finalHtml = buildSignatureHtml(logoDataUrl, form.bodyHtml)
      const data = { aliasEmail: form.aliasEmail || null, name: form.name, bodyHtml: finalHtml, isDefault: form.isDefault }
      return editingId ? emailSignatureApi.update(editingId, data) : emailSignatureApi.create(data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-signatures'] })
      setFormOpen(false)
      toast.success(editingId ? 'Signature updated' : 'Signature created')
    },
    onError: () => toast.error('Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => emailSignatureApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-signatures'] }),
    onError: () => toast.error('Delete failed'),
  })

  const grouped = new Map<string, EmailSignature[]>()
  for (const s of signatures) {
    const key = s.aliasEmail ?? ''
    const list = grouped.get(key) ?? []
    list.push(s)
    grouped.set(key, list)
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Email Signatures</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create signatures per identity (primary email, group aliases, send-as addresses).
            The default signature for each identity is auto-appended when composing.
          </p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> New</Button>
      </div>

      {signatures.length === 0 && !formOpen && (
        <p className="text-sm text-muted-foreground">No signatures yet. Click New to create one.</p>
      )}

      {Array.from(grouped.entries()).map(([alias, sigs]) => (
        <div key={alias || '__primary'} className="border rounded-md">
          <div className="px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
            {alias || 'Primary email'}
          </div>
          <div className="divide-y">
            {sigs.map(s => (
              <div key={s.id} className="px-3 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  {s.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => deleteMut.mutate(s.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {formOpen && (
        <div className="border rounded-md p-4 space-y-3 bg-muted/20">
          <h4 className="text-sm font-semibold">{editingId ? 'Edit Signature' : 'New Signature'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" placeholder="e.g. Work, Accounting" />
            </div>
            <div>
              <Label className="text-xs">Identity</Label>
              <select
                value={form.aliasEmail}
                onChange={e => setForm({ ...form, aliasEmail: e.target.value })}
                className="w-full h-8 text-sm border border-border rounded px-2 bg-transparent"
              >
                {allIdentities.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <Label className="text-xs">Company Logo (appears left of signature)</Label>
            <div className="flex items-center gap-3 mt-1">
              {logoDataUrl ? (
                <div className="relative group">
                  <img src={logoDataUrl} alt="Logo preview" className="h-16 max-w-[120px] object-contain border rounded p-1 bg-white" />
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl(null)}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Upload Logo
                </Button>
              )}
              {logoDataUrl && (
                <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                  Change
                </Button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Rich text editor for signature body */}
          <div>
            <Label className="text-xs">Signature Content</Label>
            <div className="mt-1">
              <RichTextEditor
                value={form.bodyHtml}
                onChange={html => setForm(f => ({ ...f, bodyHtml: html }))}
                placeholder="Type your signature here…"
                minHeight="120px"
                showImageButton
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
            Default for this identity
          </label>

          {/* Preview */}
          {(logoDataUrl || form.bodyHtml.replace(/<[^>]*>/g, '').trim()) && (
            <div>
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="mt-1 border rounded p-3 bg-white dark:bg-zinc-950 text-sm">
                <div dangerouslySetInnerHTML={{ __html: buildSignatureHtml(logoDataUrl, form.bodyHtml) }} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={!form.name.trim() || saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
