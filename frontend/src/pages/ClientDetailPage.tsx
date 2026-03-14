import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Globe, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ContactsPanel from '@/components/clients/ContactsPanel'
import ProjectsPanel from '@/components/clients/ProjectsPanel'
import ActivityPanel from '@/components/clients/ActivityPanel'
import EditClientModal from '@/components/clients/EditClientModal'
import DeleteClientModal from '@/components/clients/DeleteClientModal'
import { useClient } from '@/hooks/useClients'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = Number(id)

  const { data: client, isLoading } = useClient(clientId || null)

  const [editOpen, setEditOpen]     = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Link to="/clients" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Link to="/clients" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">Client not found.</p>
          <Button variant="link" onClick={() => navigate('/clients')}>Return to Clients</Button>
        </div>
      </div>
    )
  }

  const hasAddress = client.street || client.city || client.state || client.zip
  const addressLine = [client.street, client.city, client.state, client.zip]
    .filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        to="/clients"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{client.name}</h2>
            <Badge
              variant={client.status === 'Active' ? 'default' : 'secondary'}
              className={client.status === 'Active'
                ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400'
                : ''}
            >
              {client.status}
            </Badge>
          </div>

          {client.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{client.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {client.industry && (
              <span>{client.industry}</span>
            )}
            {client.website && (
              <a
                href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {client.domain || client.website}
              </a>
            )}
            {hasAddress && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {addressLine}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4">
        <div className="rounded-md border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">Contacts: </span>
          <span className="font-semibold">{client.contactCount}</span>
        </div>
        <div className="rounded-md border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">Projects: </span>
          <span className="font-semibold">{client.projectCount}</span>
        </div>
        <div className="rounded-md border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">Activity entries: </span>
          <span className="font-semibold">{client.activityCount}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts
            {client.contactCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                {client.contactCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects
            {client.projectCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                {client.projectCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity Log
            {client.activityCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                {client.activityCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-5 max-w-2xl">
          <ContactsPanel clientId={client.id} />
        </TabsContent>
        <TabsContent value="projects" className="mt-5 max-w-2xl">
          <ProjectsPanel clientId={client.id} />
        </TabsContent>
        <TabsContent value="activity" className="mt-5 max-w-2xl">
          <ActivityPanel clientId={client.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {editOpen && (
        <EditClientModal
          client={client}
          onClose={() => setEditOpen(false)}
        />
      )}
      {deleteOpen && (
        <DeleteClientModal
          client={client}
          onClose={() => {
            setDeleteOpen(false)
            // Navigate back after deletion — DeleteClientModal calls the mutation
            // but doesn't know our route; we navigate on close if client was deleted.
            navigate('/clients')
          }}
        />
      )}
    </div>
  )
}
