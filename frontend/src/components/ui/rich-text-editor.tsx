import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, List, ListOrdered,
  Link as LinkIcon, Quote, ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const FONT_OPTIONS = [
  { label: 'Default',         value: '' },
  { label: 'Arial',           value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia',         value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana',         value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS',    value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Courier New',     value: '"Courier New", Courier, monospace' },
  { label: 'Tahoma',          value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Garamond',        value: 'Garamond, serif' },
]

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  showImageButton?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  minHeight = '160px',
  showImageButton,
}: RichTextEditorProps) {
  const suppressUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      TextStyle,
      FontFamily,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      if (!suppressUpdate.current) {
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2',
        ),
        style: `min-height:${minHeight}`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      suppressUpdate.current = true
      editor.commands.setContent(value)
      suppressUpdate.current = false
    }
  }, [value, editor])

  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      editor.chain().focus().setImage({ src: dataUrl }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function currentFont(): string {
    if (!editor) return ''
    const attrs = editor.getAttributes('textStyle')
    return attrs.fontFamily ?? ''
  }

  function setFont(family: string) {
    if (!editor) return
    if (!family) {
      editor.chain().focus().unsetFontFamily().run()
    } else {
      editor.chain().focus().setFontFamily(family).run()
    }
  }

  if (!editor) return null

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
        {/* Font family dropdown */}
        <select
          value={currentFont()}
          onChange={e => setFont(e.target.value)}
          className="h-6 text-[11px] text-muted-foreground bg-transparent border border-border rounded px-1 cursor-pointer mr-1"
          title="Font family"
        >
          {FONT_OPTIONS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
              {f.label}
            </option>
          ))}
        </select>
        <Sep />
        <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></TBtn>
        <Sep />
        <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="h-3.5 w-3.5" /></TBtn>
        <Sep />
        <TBtn
          active={editor.isActive('link')}
          onClick={() => {
            const prev = editor.getAttributes('link').href ?? ''
            const url = window.prompt('Link URL', prev)
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
        </TBtn>
        {showImageButton && (
          <>
            <TBtn onClick={() => fileRef.current?.click()} title="Insert image">
              <ImageIcon className="h-3.5 w-3.5" />
            </TBtn>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function TBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title: string
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

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-border" />
}
