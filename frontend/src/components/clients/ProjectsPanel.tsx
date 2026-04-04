import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Check, X, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useAssignProjectContact,
  useUnassignProjectContact,
} from '@/hooks/useProjects'
import { useContacts } from '@/hooks/useContacts'
import { projectSchema, type ProjectFormValues } from './clientSchema'
import type { Project } from '@/api/clients'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active:    'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Completed: 'bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-950/40  dark:text-blue-400',
  'On Hold': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Cancelled: 'bg-red-100   text-red-800   border-red-300   dark:bg-red-950/40   dark:text-red-400',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toInputDate(iso: string | null): string {
  if (!iso) return ''
  return iso.substring(0, 10)
}

// ── Inline form ───────────────────────────────────────────────────────────────

interface ProjectFormProps {
  defaultValues?: ProjectFormValues
  isPending:      boolean
  onSubmit:       (values: ProjectFormValues) => void
  onCancel:       () => void
}

function ProjectForm({ defaultValues, isPending, onSubmit, onCancel }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema) as never,
    defaultValues: defaultValues ?? {
      name: '', description: '', status: 'Active', startDate: '', endDate: '',
    },
  })

  const statusValue = watch('status')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
          <Input {...register('name')} className="h-8 text-sm" placeholder="Project name" autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select
            value={statusValue}
            onValueChange={v => setValue('status', v as ProjectFormValues['status'])}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Active', 'Completed', 'On Hold', 'Cancelled'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Input {...register('description')} className="h-8 text-sm" placeholder="Optional description" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" {...register('startDate')} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input type="date" {...register('endDate')} className="h-8 text-sm" />
        </div>
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

// ── Assigned contacts row ─────────────────────────────────────────────────────

interface AssignedContactsProps {
  project:        Project
  allContacts:    { id: number; name: string; title: string }[]
  onAssign:       (contactId: number) => void
  onUnassign:     (contactId: number) => void
  isAssigning:    boolean
  isUnassigning:  boolean
}

function AssignedContacts({
  project,
  allContacts,
  onAssign,
  onUnassign,
  isAssigning,
  isUnassigning,
}: AssignedContactsProps) {
  const [open, setOpen] = useState(false)

  const assignedIds = new Set(project.assignedContacts.map(c => c.id))
  const available   = allContacts.filter(c => !assignedIds.has(c.id))

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {project.assignedContacts.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No contacts assigned</span>
      )}

      {project.assignedContacts.map(contact => (
        <span
          key={contact.id}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
        >
          <span className="font-medium">{contact.name}</span>
          {contact.title && (
            <span className="text-muted-foreground">— {contact.title}</span>
          )}
          <button
            onClick={() => onUnassign(contact.id)}
            disabled={isUnassigning}
            className="ml-0.5 rounded-full text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            title={`Remove ${contact.name}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 rounded-full"
            disabled={isAssigning}
            title="Assign contact"
          >
            <UserPlus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start">
          {available.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {allContacts.length === 0
                ? 'No contacts on this client yet.'
                : 'All contacts already assigned.'}
            </p>
          ) : (
            <div className="flex flex-col">
              {available.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => {
                    onAssign(contact.id)
                    setOpen(false)
                  }}
                  className="flex flex-col items-start rounded px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                >
                  <span className="font-medium">{contact.name}</span>
                  {contact.title && (
                    <span className="text-muted-foreground">{contact.title}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ProjectsPanelProps {
  clientId: number
}

export default function ProjectsPanel({ clientId }: ProjectsPanelProps) {
  const { data: projects = [], isLoading } = useProjects(clientId)
  const { data: contacts = [] }            = useContacts(clientId)
  const createProject   = useCreateProject(clientId)
  const updateProject   = useUpdateProject(clientId)
  const deleteProject   = useDeleteProject(clientId)
  const assignContact   = useAssignProjectContact(clientId)
  const unassignContact = useUnassignProjectContact(clientId)

  const [adding, setAdding]       = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleCreate = async (values: ProjectFormValues) => {
    await createProject.mutateAsync({
      name:        values.name,
      description: values.description,
      status:      values.status,
      startDate:   values.startDate || null,
      endDate:     values.endDate   || null,
    })
    setAdding(false)
  }

  const handleUpdate = async (id: number, values: ProjectFormValues) => {
    await updateProject.mutateAsync({
      id,
      data: {
        name:        values.name,
        description: values.description,
        status:      values.status,
        startDate:   values.startDate || null,
        endDate:     values.endDate   || null,
      },
    })
    setEditingId(null)
  }

  const handleDelete = (project: Project) => {
    if (!confirm(`Delete project "${project.name}"?`)) return
    deleteProject.mutate(project.id)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading projects…</p>

  return (
    <div className="space-y-3">
      {projects.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">No projects yet.</p>
      )}

      {projects.map(project => {
        if (editingId === project.id) {
          return (
            <ProjectForm
              key={project.id}
              defaultValues={{
                name:        project.name,
                description: project.description,
                status:      project.status as ProjectFormValues['status'],
                startDate:   toInputDate(project.startDate),
                endDate:     toInputDate(project.endDate),
              }}
              isPending={updateProject.isPending}
              onSubmit={values => handleUpdate(project.id, values)}
              onCancel={() => setEditingId(null)}
            />
          )
        }

        return (
          <div key={project.id} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link to={`/projects/${project.id}`} className="font-medium text-sm hover:underline">{project.name}</Link>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_COLORS[project.status] ?? ''}`}
                  >
                    {project.status}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground">{project.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => setEditingId(project.id)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(project)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Assigned contacts */}
            <AssignedContacts
              project={project}
              allContacts={contacts}
              onAssign={contactId =>
                assignContact.mutate({ projectId: project.id, contactId })
              }
              onUnassign={contactId =>
                unassignContact.mutate({ projectId: project.id, contactId })
              }
              isAssigning={assignContact.isPending}
              isUnassigning={unassignContact.isPending}
            />
          </div>
        )
      })}

      {adding && (
        <ProjectForm
          isPending={createProject.isPending}
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {!adding && (
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Project
        </Button>
      )}
    </div>
  )
}
