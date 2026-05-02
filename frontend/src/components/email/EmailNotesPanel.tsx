import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { emailNotesApi, type EmailNote } from '@/api/emailNotes'
import { useWorkspaceUsers } from '@/hooks/useWorkspaceUsers'
import { MentionTextarea, parseMentions } from './MentionTextarea'
import type { WorkspaceUser } from '@/api/workspace'

// Autosave the in-progress note as a localStorage draft after this many ms of idle typing.
// Also flushed synchronously when the user switches emails, closes the tab, or hides the window.
const DRAFT_AUTOSAVE_MS = 6000

function draftStorageKey(noteKey: string, userEmail: string) {
  return `bos.emailNoteDraft:${userEmail}:${noteKey}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNoteDate(iso: string) {
  const d      = new Date(iso)
  const now    = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0)    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)   return 'just now'
  if (diffMin < 60)  return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)    return `${diffH}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Note body with styled @mention chips ─────────────────────────────────────

function NoteBody({ text, users }: { text: string; users: WorkspaceUser[] }) {
  const segments = parseMentions(text, users)
  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <span
            key={i}
            className="inline-flex items-center rounded bg-primary/10 text-primary px-1 text-xs font-medium"
          >
            @{seg.display}
          </span>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </p>
  )
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  currentUserEmail,
  workspaceUsers,
  onUpdated,
  onDeleted,
}: {
  note:             EmailNote
  currentUserEmail: string
  workspaceUsers:   WorkspaceUser[]
  onUpdated:        () => void
  onDeleted:        () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(note.noteText)

  const updateMutation = useMutation({
    mutationFn: () => emailNotesApi.updateNote(note.id, editText),
    onSuccess: () => {
      setEditing(false)
      onUpdated()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => emailNotesApi.deleteNote(note.id),
    onSuccess:  onDeleted,
  })

  const isOwner = note.userEmail === currentUserEmail

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <span className="text-xs font-medium text-foreground truncate block">{note.userEmail}</span>
          <span className="text-[11px] text-muted-foreground">{formatNoteDate(note.createdAt)}</span>
        </div>
        {isOwner && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditText(note.noteText); setEditing(true) }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit note"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title="Delete note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5 mt-1">
          <MentionTextarea
            value={editText}
            onChange={setEditText}
            workspaceUsers={workspaceUsers}
            rows={3}
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => updateMutation.mutate()}
              disabled={!editText.trim() || updateMutation.isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <NoteBody text={note.noteText} users={workspaceUsers} />
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface EmailNotesPanelProps {
  messageId:    string
  noteKey?:     string   // RFC Message-ID used as the stable cross-user note key; falls back to messageId
  aliasFilter?: string   // when set, only members of this alias group are taggable
  // 'sidebar' (default): fixed-width right-rail used in the email detail view.
  // 'inline':   fills its container, no border/width constraints — used inside the ticket detail tab
  //             where the surrounding page already provides scroll and width.
  variant?:     'sidebar' | 'inline'
}

export function EmailNotesPanel({ messageId, noteKey, aliasFilter, variant = 'sidebar' }: EmailNotesPanelProps) {
  const [newNoteText, setNewNoteText] = useState('')
  const [draftSaved, setDraftSaved]   = useState(false)
  const qc = useQueryClient()

  // Use the RFC Message-ID as the note key when available so all recipients of the same
  // group email share a single set of notes, regardless of their per-mailbox Gmail message ID.
  const key = noteKey ?? messageId

  const { data: currentUser } = useQuery<{ name: string; email: string }>({
    queryKey: ['me'],
    staleTime: 5 * 60 * 1000,
  })

  const { data: workspaceUsers = [] } = useWorkspaceUsers(aliasFilter)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['email-notes', key],
    queryFn:  () => emailNotesApi.getNotes(key),
    enabled:  !!key,
  })

  const currentUserEmail = currentUser?.email ?? ''
  const draftKey         = currentUserEmail && key ? draftStorageKey(key, currentUserEmail) : ''

  // Refs track the freshest values so flush logic (cleanup / visibility / unload)
  // never reads stale closure state.
  const textRef      = useRef('')
  const lastSavedRef = useRef('')
  useEffect(() => { textRef.current = newNoteText }, [newNoteText])

  // Writes the current text to localStorage (or clears when empty). No-op if nothing changed
  // since the last flush, so switching between two untouched emails doesn't churn storage.
  function flushDraft(targetKey: string) {
    if (!targetKey) return
    const text = textRef.current
    if (text === lastSavedRef.current) return
    try {
      if (text.trim().length === 0) localStorage.removeItem(targetKey)
      else                          localStorage.setItem(targetKey, text)
    } catch {
      // localStorage can throw in private mode / over-quota — drafts are a best-effort safety net.
    }
    lastSavedRef.current = text
    setDraftSaved(text.trim().length > 0)
  }

  // Load any saved draft when the email (or user) changes, and flush whatever was
  // in the previous textarea back to its own localStorage key first.
  useEffect(() => {
    if (!draftKey) return
    let stored = ''
    try { stored = localStorage.getItem(draftKey) ?? '' } catch { /* ignore */ }
    setNewNoteText(stored)
    textRef.current      = stored
    lastSavedRef.current = stored
    setDraftSaved(stored.trim().length > 0)

    return () => {
      // Runs when draftKey changes (email switch) or the panel unmounts — captures the
      // OLD draftKey via closure so the old email's in-progress note gets persisted.
      flushDraft(draftKey)
    }
  }, [draftKey])

  // 6-second idle autosave. Resets on every keystroke.
  useEffect(() => {
    if (!draftKey) return
    if (newNoteText === lastSavedRef.current) return
    setDraftSaved(false)
    const timer = window.setTimeout(() => flushDraft(draftKey), DRAFT_AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [newNoteText, draftKey])

  // Tab close / navigate away / tab hide — flush synchronously so the draft survives.
  useEffect(() => {
    if (!draftKey) return
    const handler = () => flushDraft(draftKey)
    window.addEventListener('beforeunload', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [draftKey])

  const createMutation = useMutation({
    mutationFn: () => emailNotesApi.createNote(key, newNoteText),
    onSuccess: () => {
      setNewNoteText('')
      textRef.current      = ''
      lastSavedRef.current = ''
      setDraftSaved(false)
      if (draftKey) {
        try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
      }
      qc.invalidateQueries({ queryKey: ['email-notes', key] })
      qc.invalidateQueries({ queryKey: ['email-note-counts'] })
    },
  })

  function invalidateAfterChange() {
    qc.invalidateQueries({ queryKey: ['email-notes', key] })
    qc.invalidateQueries({ queryKey: ['email-note-counts'] })
  }

  const containerClass = variant === 'sidebar'
    ? 'w-72 shrink-0 flex flex-col border-l border-border overflow-hidden'
    : 'flex flex-col w-full'
  const listClass = variant === 'sidebar'
    ? 'flex-1 overflow-y-auto p-3 space-y-2'
    : 'p-3 space-y-2'

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</span>
        {notes.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
            {notes.length}
          </span>
        )}
      </div>

      {/* Note list */}
      <div className={listClass}>
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No notes yet.</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
              <NoteCard
                note={note}
                currentUserEmail={currentUserEmail}
                workspaceUsers={workspaceUsers}
                onUpdated={invalidateAfterChange}
                onDeleted={invalidateAfterChange}
              />
            </div>
          ))
        )}
      </div>

      {/* Add note footer */}
      <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
        <MentionTextarea
          value={newNoteText}
          onChange={setNewNoteText}
          workspaceUsers={workspaceUsers}
          placeholder="Add a note… (type @ to mention)"
          rows={2}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && newNoteText.trim()) {
              createMutation.mutate()
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => createMutation.mutate()}
            disabled={!newNoteText.trim() || createMutation.isPending}
          >
            Add Note
          </Button>
          {newNoteText.trim().length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {draftSaved ? 'Draft saved' : 'Typing…'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
