import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { WorkspaceUser } from '@/api/workspace'

// ── Mention parsing helpers (shared with NoteBody below) ─────────────────────

// Matches @email@domain.tld within text
const MENTION_RE = /@([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g

export interface MentionSegment {
  type:    'text' | 'mention'
  content: string       // raw text or email address
  display: string       // display name for mention, or same as content for text
}

/** Splits a note string into plain-text and @mention segments. */
export function parseMentions(
  text:  string,
  users: WorkspaceUser[],
): MentionSegment[] {
  const segments: MentionSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const re = new RegExp(MENTION_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index), display: text.slice(lastIndex, match.index) })
    }
    const email   = match[1]
    const user    = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    segments.push({ type: 'mention', content: email, display: user?.name ?? email })
    lastIndex = re.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex), display: text.slice(lastIndex) })
  }

  return segments
}

// ── Trigger detection ─────────────────────────────────────────────────────────

interface TriggerState {
  query:      string   // text after the @ up to the cursor
  startIndex: number   // index of the @ character in the full text
}

function detectMentionTrigger(
  value:  string,
  cursor: number,
): TriggerState | null {
  // Walk backwards from cursor to find an @ preceded by whitespace or start of text
  const textUpToCursor = value.slice(0, cursor)
  const atIdx = textUpToCursor.lastIndexOf('@')
  if (atIdx === -1) return null

  const charBefore = atIdx > 0 ? textUpToCursor[atIdx - 1] : ' '
  if (!/[\s\n]/.test(charBefore) && atIdx !== 0) return null

  const query = textUpToCursor.slice(atIdx + 1)
  // Cancel if there's a space in the query (user moved past this mention)
  if (/\s/.test(query)) return null

  return { query, startIndex: atIdx }
}

// ── Main component ────────────────────────────────────────────────────────────

interface MentionTextareaProps {
  value:          string
  onChange:       (value: string) => void
  workspaceUsers: WorkspaceUser[]
  placeholder?:   string
  rows?:          number
  className?:     string
  autoFocus?:     boolean
  onKeyDown?:     (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function MentionTextarea({
  value,
  onChange,
  workspaceUsers,
  placeholder,
  rows = 3,
  className,
  autoFocus,
  onKeyDown,
}: MentionTextareaProps) {
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)
  const [trigger, setTrigger]         = useState<TriggerState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Filter users by the current query
  const suggestions = trigger
    ? workspaceUsers
        .filter(u => {
          const q = trigger.query.toLowerCase()
          return (
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
          )
        })
        .slice(0, 8)
    : []

  // Reset active index whenever suggestions change
  useEffect(() => { setActiveIndex(0) }, [suggestions.length])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    const cursor   = e.target.selectionStart ?? newValue.length
    onChange(newValue)
    setTrigger(detectMentionTrigger(newValue, cursor))
  }

  function handleSelect(user: WorkspaceUser) {
    if (!trigger) return
    const mention = `@${user.email} `
    const before  = value.slice(0, trigger.startIndex)
    const after   = value.slice(trigger.startIndex + 1 + trigger.query.length)
    const next    = before + mention + after
    onChange(next)
    setTrigger(null)

    // Restore focus and move cursor to after the inserted mention
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const pos = (before + mention).length
      el.setSelectionRange(pos, pos)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (trigger && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelect(suggestions[activeIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  function handleClick() {
    const el = textareaRef.current
    if (!el) return
    setTrigger(detectMentionTrigger(el.value, el.selectionStart ?? 0))
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onBlur={() => {
          // Delay so click on dropdown item fires first
          setTimeout(() => setTrigger(null), 150)
        }}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          'w-full text-sm rounded border border-input bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring',
          className,
        )}
      />

      {/* Mention dropdown */}
      {trigger && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((user, i) => (
              <li key={user.email}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(user) }}
                  className={cn(
                    'w-full text-left px-3 py-2 flex flex-col transition-colors',
                    i === activeIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="text-sm font-medium leading-tight">{user.name}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{user.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
