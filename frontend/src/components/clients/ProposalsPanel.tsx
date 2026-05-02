import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { proposalApi, type ProposalListItem, type ProposalType } from '@/api/proposals'

const STATUS_COLORS: Record<string, string> = {
  Draft:     'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300',
  Sent:      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
  Accepted:  'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400',
  Converted: 'bg-blue-100  text-blue-800  border-blue-300  dark:bg-blue-950/40  dark:text-blue-400',
  Rejected:  'bg-red-100   text-red-800   border-red-300   dark:bg-red-950/40   dark:text-red-400',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProposalsPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showConverted, setShowConverted] = useState(false)
  const [newTypeDialog, setNewTypeDialog] = useState(false)

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', clientId, showConverted],
    queryFn:  () => proposalApi.list(clientId, showConverted),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => proposalApi.delete(clientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals', clientId] })
      toast.success('Proposal deleted')
    },
    onError: () => toast.error('Failed to delete proposal'),
  })

  const createMut = useMutation({
    mutationFn: (type: ProposalType) =>
      proposalApi.create(clientId, {
        name: type === 'SingleFamily' ? 'New Single-Family Proposal' : 'New Multi-Family Proposal',
        type,
        status: 'Draft',
        deadline: null,
        deadlineReminderDays: null,
        notes: null,
        visibleFields: null,
        libraryId: null,
        address: '', city: '', productStandards: '', version: '',
        buyerUpgrades: '', revisionsAfterLaunch: '',
        buildings: type === 'MultiFamily' ? [] : null,
        customUpgrades: [],
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['proposals', clientId] })
      setNewTypeDialog(false)
      navigate(`/clients/${clientId}/proposals/${created.id}`)
    },
    onError: () => toast.error('Failed to create proposal'),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showConverted}
            onChange={e => setShowConverted(e.target.checked)}
          />
          Show converted
        </label>
        <Button size="sm" onClick={() => setNewTypeDialog(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Proposal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {showConverted ? 'No proposals yet.' : 'No active proposals. Toggle "Show converted" to see history.'}
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map(p => (
            <ProposalRow
              key={p.id}
              clientId={clientId}
              proposal={p}
              onDelete={() => {
                if (confirm(`Delete proposal "${p.name}"? This cannot be undone.`))
                  deleteMut.mutate(p.id)
              }}
            />
          ))}
        </div>
      )}

      {newTypeDialog && (
        <Dialog open onOpenChange={(o) => !o && setNewTypeDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Proposal — pick a type</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => createMut.mutate('SingleFamily')}
                disabled={createMut.isPending}
                className="rounded-lg border-2 p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              >
                <h4 className="text-sm font-semibold">Single Family</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  One library, address, product standards, and version. Plus free-form upgrade and revision notes.
                </p>
              </button>
              <button
                onClick={() => createMut.mutate('MultiFamily')}
                disabled={createMut.isPending}
                className="rounded-lg border-2 p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              >
                <h4 className="text-sm font-semibold">Multi Family</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Multiple buildings, each with one or more plans (square footage + price).
                </p>
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setNewTypeDialog(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface ProposalRowProps {
  clientId: number
  proposal: ProposalListItem
  onDelete: () => void
}

function ProposalRow({ clientId, proposal, onDelete }: ProposalRowProps) {
  return (
    <div className="rounded-md border bg-card p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/clients/${clientId}/proposals/${proposal.id}`}
            className="text-sm font-semibold hover:underline truncate"
          >
            {proposal.name}
          </Link>
          <Badge variant="outline" className="text-[10px]">
            {proposal.type === 'SingleFamily' ? 'Single Family' : 'Multi Family'}
          </Badge>
          <Badge
            variant="outline"
            className={STATUS_COLORS[proposal.status] ?? ''}
          >
            {proposal.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
          <span>Created {fmtDate(proposal.createdAt)}</span>
          <span>Updated {fmtDate(proposal.updatedAt)}</span>
          {proposal.convertedProjectId && (
            <Link
              to={`/projects/${proposal.convertedProjectId}`}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              View project <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link to={`/clients/${clientId}/proposals/${proposal.id}`}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
        {proposal.status !== 'Converted' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
