import { useState, useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Link as LinkIcon, Quote,
  Paperclip, Send, Save, Trash2, X, ChevronDown, FileText,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  useSendMessage, useReplyMessage, useForwardMessage,
  useSaveDraft, useDeleteDraft,
} from '@/hooks/useGmail'
import { cannedResponseApi, type CannedResponse } from '@/api/cannedResponses'
import { emailSignatureApi } from '@/api/emailSignatures'
import type { ComposeInput, EmailDetail } from '@/api/gmail'

// ─────────────────────────────────────────────────────────────────────────────

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward'

interface ComposeDialogProps {
  open:        boolean
  onClose:     () => void
  mode:        ComposeMode
  source?:     EmailDetail
  initialTo?:  string
  draftId?:    string | null
  inline?:     boolean
}

// ── Signature helpers ───────────────────────────────────────────────────────

const SIG_MARKER = '<!-- bos-signature -->'

function wrapSignatureHtml(html: string) {
  return `${SIG_MARKER}<div style="margin-top:16px;border-top:1px solid #ccc;padding-top:8px">${html}</div>`
}

// ─────────────────────────────────────────────────────────────────────────────

export function ComposeDialog({
  open, onClose, mode, source, initialTo, draftId: initialDraftId, inline,
}: ComposeDialogProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [to,      setTo]      = useState('')
  const [cc,      setCc]      = useState('')
  const [bcc,     setBcc]     = useState('')
  const [subject, setSubject] = useState('')
  const [showCc,  setShowCc]  = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [files,   setFiles]   = useState<File[]>([])
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null)
  const [fromAddress, setFromAddress] = useState<string>('')
  const [showCannedPicker, setShowCannedPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Canned responses ──────────────────────────────────────────────────────
  const { data: cannedResponses = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn:  cannedResponseApi.list,
    staleTime: 60_000,
    enabled:  open,
  })

  const cannedByCategory = useMemo(() => {
    const map = new Map<string, CannedResponse[]>()
    for (const r of cannedResponses) {
      const list = map.get(r.categoryName) ?? []
      list.push(r)
      map.set(r.categoryName, list)
    }
    return map
  }, [cannedResponses])

  // ── Send-as & signatures ──────────────────────────────────────────────────
  const { data: sendAsAddresses = [] } = useQuery({
    queryKey: ['gmail-send-as'],
    queryFn:  emailSignatureApi.getSendAsAddresses,
    staleTime: 5 * 60_000,
    enabled:  open,
  })

  const { data: allSignatures = [] } = useQuery({
    queryKey: ['email-signatures'],
    queryFn:  emailSignatureApi.list,
    staleTime: 60_000,
    enabled:  open,
  })

  const signaturesForFrom = useMemo(
    () => allSignatures.filter(s => s.aliasEmail === (fromAddress || null) || (s.aliasEmail == null && !fromAddress)),
    [allSignatures, fromAddress],
  )

  const [selectedSigId, setSelectedSigId] = useState<number | null>(null)

  const selectedSignature = useMemo(
    () => selectedSigId ? allSignatures.find(s => s.id === selectedSigId) ?? null : null,
    [selectedSigId, allSignatures],
  )

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendNew      = useSendMessage()
  const sendReply    = useReplyMessage()
  const sendForward  = useForwardMessage()
  const saveDraftMut = useSaveDraft()
  const deleteDraft  = useDeleteDraft()

  // ── Editor ─────────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      FontFamily,
      Placeholder.configure({ placeholder: 'Write your message…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[240px] px-3 py-2 ' +
          'focus:outline-none',
      },
    },
  })

  // ── Signature selection helpers ───────────────────────────────────────────

  function getDefaultSig(fromAddr: string) {
    return allSignatures.find(
      s => s.isDefault && (s.aliasEmail === (fromAddr || null) || (s.aliasEmail == null && !fromAddr))
    ) ?? null
  }

  // Re-apply signature when fromAddress changes (user switches identity while composing)
  const fromRef = useRef(fromAddress)
  useEffect(() => {
    if (!open || !editor) return
    if (fromRef.current === fromAddress) return
    fromRef.current = fromAddress
    const sig = getDefaultSig(fromAddress)
    setSelectedSigId(sig?.id ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAddress, allSignatures, open, editor])

  // ── Mode-driven prefill ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !editor) return

    setFiles([])

    if (initialDraftId) {
      setDraftId(initialDraftId)
      return
    }

    setDraftId(null)

    let resolvedFrom = ''

    if (mode === 'new') {
      setTo(initialTo ?? '')
      setCc(''); setBcc(''); setSubject('')
      setShowCc(false); setShowBcc(false)
      editor.commands.setContent('')
    } else if (source) {
      const senderAddr = source.fromAddress
      const subj       = source.subject ?? ''

      const toAddrs = (source.toAddresses ?? '').toLowerCase()
      const matchedSendAs = sendAsAddresses.find(a => toAddrs.includes(a.email.toLowerCase()))
      if (matchedSendAs && !matchedSendAs.isPrimary) {
        resolvedFrom = matchedSendAs.email
        setFromAddress(matchedSendAs.email)
      } else {
        setFromAddress('')
      }

      if (mode === 'reply') {
        setTo(senderAddr)
        setCc('')
        setSubject(subj.startsWith('Re:') ? subj : `Re: ${subj}`)
        editor.commands.setContent(buildQuotedBody(source))
      }
      else if (mode === 'replyAll') {
        setTo(senderAddr)
        const otherTo = (source.toAddresses ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const otherCc = (source.ccAddresses ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const ccCombined = [...otherTo, ...otherCc].filter(addr => !addr.includes(senderAddr)).join(', ')
        setCc(ccCombined)
        setShowCc(ccCombined.length > 0)
        setSubject(subj.startsWith('Re:') ? subj : `Re: ${subj}`)
        editor.commands.setContent(buildQuotedBody(source))
      }
      else if (mode === 'forward') {
        setTo('')
        setCc('')
        setSubject(subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`)
        editor.commands.setContent(buildForwardedBody(source))
      }
    }

    fromRef.current = resolvedFrom
    const sig = getDefaultSig(resolvedFrom)
    setSelectedSigId(sig?.id ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, source?.messageId, initialDraftId, editor, allSignatures])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function pickFiles() { fileInputRef.current?.click() }

  function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    if (incoming.length === 0) return
    const totalAfter = [...files, ...incoming].reduce((s, f) => s + f.size, 0)
    if (totalAfter > 25 * 1024 * 1024) {
      toast.error('Attachment total exceeds 25 MB.')
      e.target.value = ''
      return
    }
    setFiles([...files, ...incoming])
    e.target.value = ''
  }

  function removeFile(idx: number) {
    setFiles(files.filter((_, i) => i !== idx))
  }

  async function insertCannedResponse(r: CannedResponse) {
    if (r.subject && !subject.trim()) setSubject(r.subject)

    // Apply default recipients only when the user has left those fields blank,
    // so a partially-filled compose window isn't clobbered.
    if (r.defaultTo  && !to.trim())  setTo(r.defaultTo)
    if (r.defaultCc  && !cc.trim())  { setCc(r.defaultCc);   setShowCc(true) }
    if (r.defaultBcc && !bcc.trim()) { setBcc(r.defaultBcc); setShowBcc(true) }

    editor?.commands.insertContent(r.bodyHtml)
    setShowCannedPicker(false)

    if (r.attachments.length > 0) {
      try {
        const fetched = await Promise.all(r.attachments.map(async (att) => {
          const res = await fetch(cannedResponseApi.attachmentDownloadUrl(att.id), {
            credentials: 'include',
          })
          if (!res.ok) throw new Error(`Failed to fetch ${att.fileName}`)
          const blob = await res.blob()
          return new File([blob], att.fileName, { type: att.contentType })
        }))
        setFiles((curr) => [...curr, ...fetched])
      } catch {
        toast.error('Failed to load canned-response attachments.')
      }
    }
  }

  function handleSignatureChange(sigId: string) {
    setSelectedSigId(sigId === '' ? null : Number(sigId))
  }

  function buildBodyWithSignature(): string {
    const body = editor?.getHTML() ?? ''
    if (!selectedSignature) return body
    return body + wrapSignatureHtml(selectedSignature.bodyHtml)
  }

  function buildInput(): ComposeInput {
    return {
      to,
      cc:       cc  || undefined,
      bcc:      bcc || undefined,
      subject,
      bodyHtml: buildBodyWithSignature(),
      bodyText: editor?.getText() ?? undefined,
      attachments: files.length > 0 ? files : undefined,
      from: fromAddress || undefined,
    }
  }

  function validate(): string | null {
    if (!to.trim()) return 'Recipient is required.'
    return null
  }

  async function handleSend() {
    const err = validate()
    if (err) { toast.error(err); return }

    const input = buildInput()
    try {
      if (mode === 'new') {
        await sendNew.mutateAsync(input)
      } else if (mode === 'reply' || mode === 'replyAll') {
        if (!source) throw new Error('Missing source message.')
        await sendReply.mutateAsync({
          sourceMessageId: source.messageId,
          input,
          replyAll: mode === 'replyAll',
        })
      } else {
        if (!source) throw new Error('Missing source message.')
        await sendForward.mutateAsync({
          sourceMessageId:            source.messageId,
          input,
          includeOriginalAttachments: true,
        })
      }
      if (draftId) {
        try { await deleteDraft.mutateAsync(draftId) } catch { /* ignore */ }
      }
      toast.success(mode === 'new' ? 'Message sent' : mode === 'forward' ? 'Forwarded' : 'Reply sent')
      onClose()
    } catch (e: unknown) {
      const err = e as Record<string, Record<string, Record<string, string>>>
      toast.error(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Send failed'))
    }
  }

  async function handleSaveDraft() {
    const input = buildInput()
    try {
      const result = await saveDraftMut.mutateAsync({
        input,
        draftId,
        sourceMessageId: source?.messageId ?? null,
        replyAll: mode === 'replyAll',
      })
      setDraftId(result.draftId)
      toast.success('Draft saved')
    } catch (e: unknown) {
      const err = e as Record<string, Record<string, Record<string, string>>>
      toast.error(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Save failed'))
    }
  }

  async function handleDiscardDraft() {
    if (!draftId) { onClose(); return }
    try {
      await deleteDraft.mutateAsync(draftId)
      toast.success('Draft discarded')
      onClose()
    } catch (e: unknown) {
      const err = e as Record<string, Record<string, Record<string, string>>>
      toast.error(err?.response?.data?.error ?? 'Failed to discard draft')
    }
  }

  const isSending = sendNew.isPending || sendReply.isPending || sendForward.isPending
  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files])

  // ── Render ─────────────────────────────────────────────────────────────────
  const title =
    mode === 'reply'    ? 'Reply' :
    mode === 'replyAll' ? 'Reply all' :
    mode === 'forward'  ? 'Forward' : 'New message'

  const formContent = (
    <>
      {!inline && (
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
      )}

      {inline && (
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

        {/* From / Send-as selector */}
        {sendAsAddresses.length > 1 && (
          <div className="px-5 py-2 border-b flex items-center gap-2">
            <Label className="w-10 text-xs text-muted-foreground">From</Label>
            <select
              value={fromAddress}
              onChange={e => setFromAddress(e.target.value)}
              className="flex-1 h-7 text-sm bg-transparent border border-border rounded px-2 focus:outline-none"
            >
              {sendAsAddresses.map(a => (
                <option key={a.email} value={a.isPrimary ? '' : a.email}>
                  {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                  {a.isPrimary ? ' (primary)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Recipient fields */}
        <div className="px-5 py-3 space-y-2 border-b">
          <RecipientRow label="To" value={to} onChange={setTo}>
            <div className="flex gap-2">
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)}
                  className="text-xs text-muted-foreground hover:text-foreground">Cc</button>
              )}
              {!showBcc && (
                <button type="button" onClick={() => setShowBcc(true)}
                  className="text-xs text-muted-foreground hover:text-foreground">Bcc</button>
              )}
            </div>
          </RecipientRow>
          {showCc  && <RecipientRow label="Cc"  value={cc}  onChange={setCc} />}
          {showBcc && <RecipientRow label="Bcc" value={bcc} onChange={setBcc} />}
          <div className="flex items-center gap-2">
            <Label className="w-10 text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="h-7 text-sm border-none focus-visible:ring-0 px-1"
              placeholder="(no subject)"
            />
          </div>
        </div>

        {/* Toolbar */}
        {editor && (
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b bg-muted/30">
            <select
              value={editor.getAttributes('textStyle').fontFamily ?? ''}
              onChange={e => {
                if (!e.target.value) editor.chain().focus().unsetFontFamily().run()
                else editor.chain().focus().setFontFamily(e.target.value).run()
              }}
              className="h-6 text-[11px] text-muted-foreground bg-transparent border border-border rounded px-1 cursor-pointer mr-1"
              title="Font family"
            >
              <option value="">Default</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="&quot;Times New Roman&quot;, Times, serif">Times New Roman</option>
              <option value="Verdana, Geneva, sans-serif">Verdana</option>
              <option value="&quot;Trebuchet MS&quot;, Helvetica, sans-serif">Trebuchet MS</option>
              <option value="&quot;Courier New&quot;, Courier, monospace">Courier New</option>
              <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
              <option value="Garamond, serif">Garamond</option>
            </select>
            <Separator />
            <ToolbarBtn active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>
            <Separator />
            <ToolbarBtn active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list"><List className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('blockquote')}  onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Quote"><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
            <Separator />
            <ToolbarBtn
              active={editor.isActive('link')}
              onClick={() => {
                const prev = editor.getAttributes('link').href ?? ''
                const url  = window.prompt('Link URL', prev)
                if (url === null) return
                if (url === '') {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                } else {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                }
              }}
              title="Link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <Separator />
            <ToolbarBtn onClick={pickFiles} title="Attach files"><Paperclip className="h-3.5 w-3.5" /></ToolbarBtn>
            <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesChosen} />

            {/* Canned responses */}
            {cannedResponses.length > 0 && (
              <div className="relative ml-1">
                <ToolbarBtn
                  onClick={() => setShowCannedPicker(v => !v)}
                  title="Insert canned response"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                </ToolbarBtn>
                {showCannedPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCannedPicker(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg">
                      {Array.from(cannedByCategory.entries()).map(([catName, responses]) => (
                        <div key={catName}>
                          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                            {catName}
                          </p>
                          {responses.map(r => (
                            <button
                              key={r.id}
                              onClick={() => insertCannedResponse(r)}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                            >
                              <span className="font-medium">{r.name}</span>
                              {r.subject && (
                                <span className="ml-1.5 text-xs text-muted-foreground">({r.subject})</span>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Signature picker */}
            {signaturesForFrom.length > 0 && (
              <>
                <Separator />
                <select
                  value={selectedSigId ?? ''}
                  onChange={e => handleSignatureChange(e.target.value)}
                  className="h-6 text-[11px] text-muted-foreground bg-transparent border border-border rounded px-1 cursor-pointer"
                  title="Email signature"
                >
                  <option value="">No signature</option>
                  {signaturesForFrom.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (default)' : ''}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {/* Editor */}
        <div className={cn(
          'overflow-y-auto',
          inline ? 'flex-1' : 'max-h-[55vh]',
        )}>
          <EditorContent editor={editor} />

          {/* Signature preview — rendered as real HTML below the editor */}
          {selectedSignature && (
            <div className="px-3 pb-3">
              <div
                style={{ marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 8 }}
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: selectedSignature.bodyHtml }}
              />
            </div>
          )}
        </div>

        {/* Attachment chips */}
        {files.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/20 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[180px]">{f.name}</span>
                <span className="text-muted-foreground">{fmtSize(f.size)}</span>
                <button type="button" onClick={() => removeFile(i)}
                  className="ml-0.5 text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground self-center">
              {fmtSize(totalSize)} total
            </span>
          </div>
        )}

        <div className={cn('px-5 py-3 border-t flex justify-between gap-2', !inline && 'sm:justify-between')}>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSend} disabled={isSending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {isSending ? 'Sending…' : 'Send'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={saveDraftMut.isPending}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saveDraftMut.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
          <div className="flex gap-2">
            {draftId && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                onClick={handleDiscardDraft} disabled={deleteDraft.isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Discard draft
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              {inline ? 'Discard' : 'Cancel'}
            </Button>
          </div>
        </div>
    </>
  )

  if (inline) {
    if (!open) return null
    return (
      <div className="flex-1 flex flex-col border-b border-border bg-background overflow-hidden">
        {formContent}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        {formContent}
      </DialogContent>
    </Dialog>
  )
}

// ── Subcomponents / helpers ───────────────────────────────────────────────────

function RecipientRow({
  label, value, onChange, children,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-10 text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 text-sm border-none focus-visible:ring-0 px-1 flex-1"
        placeholder="name@example.com, …"
      />
      {children}
    </div>
  )
}

function ToolbarBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode
  onClick:  () => void
  active?:  boolean
  title:    string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded p-1 transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <span className="mx-0.5 h-4 w-px bg-border" />
}

function fmtSize(bytes: number) {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildQuotedBody(source: EmailDetail): string {
  const date  = new Date(source.receivedAt).toLocaleString()
  const from  = source.fromName
    ? `${escapeHtml(source.fromName)} &lt;${escapeHtml(source.fromAddress)}&gt;`
    : escapeHtml(source.fromAddress)
  const inner = source.bodyHtml
    ?? (source.bodyText ? `<pre>${escapeHtml(source.bodyText)}</pre>` : '')

  return (
    `<p></p>` +
    `<blockquote>` +
      `<p>On ${escapeHtml(date)}, ${from} wrote:</p>` +
      inner +
    `</blockquote>`
  )
}

function buildForwardedBody(source: EmailDetail): string {
  const date = new Date(source.receivedAt).toLocaleString()
  const from = source.fromName
    ? `${escapeHtml(source.fromName)} &lt;${escapeHtml(source.fromAddress)}&gt;`
    : escapeHtml(source.fromAddress)
  const inner = source.bodyHtml
    ?? (source.bodyText ? `<pre>${escapeHtml(source.bodyText)}</pre>` : '')

  return (
    `<p></p>` +
    `<p>---------- Forwarded message ----------</p>` +
    `<p><strong>From:</strong> ${from}<br/>` +
    `<strong>Date:</strong> ${escapeHtml(date)}<br/>` +
    `<strong>Subject:</strong> ${escapeHtml(source.subject ?? '')}<br/>` +
    `<strong>To:</strong> ${escapeHtml(source.toAddresses ?? '')}` +
    (source.ccAddresses ? `<br/><strong>Cc:</strong> ${escapeHtml(source.ccAddresses)}` : '') +
    `</p>` +
    inner
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
