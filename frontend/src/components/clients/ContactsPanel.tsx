import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Check, X, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from '@/hooks/useContacts'
import { contactSchema, type ContactFormValues } from './clientSchema'
import type { Contact } from '@/api/clients'

interface ContactsPanelProps {
  clientId: number
}

// ── Inline form ───────────────────────────────────────────────────────────────

interface ContactFormProps {
  defaultValues?: ContactFormValues
  isPending:      boolean
  onSubmit:       (values: ContactFormValues) => void
  onCancel:       () => void
}

function ContactForm({ defaultValues, isPending, onSubmit, onCancel }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema) as never,
    defaultValues: defaultValues ?? { name: '', email: '', phone: '', title: '', isPrimary: false },
  })

  const isPrimary = watch('isPrimary')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
          <Input {...register('name')} className="h-8 text-sm" placeholder="Jane Smith" autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Title / Role</Label>
          <Input {...register('title')} className="h-8 text-sm" placeholder="Procurement Manager" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input {...register('email')} className="h-8 text-sm" placeholder="jane@example.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input {...register('phone')} className="h-8 text-sm" placeholder="+1 555 000 0000" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="isPrimary"
          checked={isPrimary}
          onCheckedChange={v => setValue('isPrimary', Boolean(v))}
        />
        <label htmlFor="isPrimary" className="text-xs cursor-pointer">Mark as primary contact</label>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1 h-3 w-3" />
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function ContactsPanel({ clientId }: ContactsPanelProps) {
  const { data: contacts = [], isLoading } = useContacts(clientId)
  const createContact = useCreateContact(clientId)
  const updateContact = useUpdateContact(clientId)
  const deleteContact = useDeleteContact(clientId)

  const [adding, setAdding]           = useState(false)
  const [editingId, setEditingId]     = useState<number | null>(null)

  const handleCreate = async (values: ContactFormValues) => {
    await createContact.mutateAsync(values)
    setAdding(false)
  }

  const handleUpdate = async (id: number, values: ContactFormValues) => {
    await updateContact.mutateAsync({ id, data: values })
    setEditingId(null)
  }

  const handleDelete = (contact: Contact) => {
    if (!confirm(`Remove contact "${contact.name}"?`)) return
    deleteContact.mutate(contact.id)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contacts…</p>

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">No contacts yet.</p>
      )}

      {contacts.map(contact => {
        if (editingId === contact.id) {
          return (
            <ContactForm
              key={contact.id}
              defaultValues={{
                name: contact.name, email: contact.email,
                phone: contact.phone, title: contact.title,
                isPrimary: contact.isPrimary,
              }}
              isPending={updateContact.isPending}
              onSubmit={values => handleUpdate(contact.id, values)}
              onCancel={() => setEditingId(null)}
            />
          )
        }

        return (
          <div key={contact.id} className="flex items-start justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{contact.name}</span>
                {contact.isPrimary && (
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 gap-0.5">
                    <Star className="h-2.5 w-2.5" /> Primary
                  </Badge>
                )}
              </div>
              {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
              <div className="flex gap-3 text-xs text-muted-foreground">
                {contact.email && <span>{contact.email}</span>}
                {contact.phone && <span>{contact.phone}</span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => setEditingId(contact.id)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(contact)} title="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}

      {adding && (
        <ContactForm
          isPending={createContact.isPending}
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && (
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Contact
        </Button>
      )}
    </div>
  )
}
