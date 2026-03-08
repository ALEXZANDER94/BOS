import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Check, X, Phone, Mail, Users, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useActivityLogs,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
} from '@/hooks/useActivityLogs'
import { activitySchema, type ActivityFormValues } from './clientSchema'
import type { ActivityLog } from '@/api/clients'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Call:    <Phone    className="h-3.5 w-3.5" />,
  Email:   <Mail     className="h-3.5 w-3.5" />,
  Meeting: <Users    className="h-3.5 w-3.5" />,
  Note:    <FileText className="h-3.5 w-3.5" />,
}

const TYPE_COLORS: Record<string, string> = {
  Call:    'border-blue-300   text-blue-700   dark:text-blue-400',
  Email:   'border-purple-300 text-purple-700 dark:text-purple-400',
  Meeting: 'border-green-300  text-green-700  dark:text-green-400',
  Note:    'border-gray-300   text-gray-700   dark:text-gray-400',
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function toInputDatetime(iso: string): string {
  // Return date-only portion for input[type=date]
  return iso.substring(0, 10)
}

// ── Inline form ───────────────────────────────────────────────────────────────

interface ActivityFormProps {
  defaultValues?: ActivityFormValues
  isPending:      boolean
  onSubmit:       (values: ActivityFormValues) => void
  onCancel:       () => void
}

function ActivityForm({ defaultValues, isPending, onSubmit, onCancel }: ActivityFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema) as never,
    defaultValues: defaultValues ?? {
      type:       'Note',
      note:       '',
      occurredAt: new Date().toISOString().substring(0, 10),
    },
  })

  const typeValue = watch('type')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={typeValue}
            onValueChange={v => setValue('type', v as ActivityFormValues['type'])}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Call', 'Email', 'Meeting', 'Note'].map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" {...register('occurredAt')} className="h-8 text-sm" />
          {errors.occurredAt && <p className="text-xs text-destructive">{errors.occurredAt.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note <span className="text-destructive">*</span></Label>
        <Textarea
          {...register('note')}
          className="text-sm min-h-[60px] resize-none"
          placeholder="Describe the activity…"
          autoFocus
        />
        {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1 h-3 w-3" />
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
      </div>
    </form>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ActivityPanelProps {
  clientId: number
}

export default function ActivityPanel({ clientId }: ActivityPanelProps) {
  const { data: logs = [], isLoading } = useActivityLogs(clientId)
  const createActivity = useCreateActivity(clientId)
  const updateActivity = useUpdateActivity(clientId)
  const deleteActivity = useDeleteActivity(clientId)

  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const toIso = (dateStr: string) => new Date(dateStr).toISOString()

  const handleCreate = async (values: ActivityFormValues) => {
    await createActivity.mutateAsync({
      type:       values.type,
      note:       values.note,
      occurredAt: toIso(values.occurredAt),
    })
    setAdding(false)
  }

  const handleUpdate = async (id: number, values: ActivityFormValues) => {
    await updateActivity.mutateAsync({
      id,
      data: {
        type:       values.type,
        note:       values.note,
        occurredAt: toIso(values.occurredAt),
      },
    })
    setEditingId(null)
  }

  const handleDelete = (log: ActivityLog) => {
    if (!confirm('Delete this activity entry?')) return
    deleteActivity.mutate(log.id)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading activity…</p>

  return (
    <div className="space-y-3">
      {logs.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">No activity logged yet.</p>
      )}

      {logs.map(log => {
        if (editingId === log.id) {
          return (
            <ActivityForm
              key={log.id}
              defaultValues={{
                type:       log.type as ActivityFormValues['type'],
                note:       log.note,
                occurredAt: toInputDatetime(log.occurredAt),
              }}
              isPending={updateActivity.isPending}
              onSubmit={values => handleUpdate(log.id, values)}
              onCancel={() => setEditingId(null)}
            />
          )
        }

        return (
          <div key={log.id} className="flex items-start justify-between rounded-md border p-3">
            <div className="flex gap-2.5">
              <div className={`mt-0.5 shrink-0 ${TYPE_COLORS[log.type] ?? ''}`}>
                {TYPE_ICONS[log.type] ?? <FileText className="h-3.5 w-3.5" />}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${TYPE_COLORS[log.type] ?? ''}`}
                  >
                    {log.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(log.occurredAt)}</span>
                </div>
                <p className="text-sm">{log.note}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => setEditingId(log.id)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(log)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}

      {adding && (
        <ActivityForm
          isPending={createActivity.isPending}
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && (
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Log Activity
        </Button>
      )}
    </div>
  )
}
