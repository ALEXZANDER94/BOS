import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Save, Plus, Trash2, ArrowRightCircle, AlertCircle,
  Upload, FileText, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  proposalApi,
  type ProposalStatus,
  type ProposalBuildingInput,
  type ProposalUpgradeInput,
  type ProposalPricing,
  type CreateProposalPricingRequest,
} from '@/api/proposals'
import { libraryApi } from '@/api/libraries'
import { customUpgradeApi } from '@/api/customUpgrades'

const STATUSES: ProposalStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected']

const SINGLE_FAMILY_OPTIONAL_FIELDS = [
  { key: 'productStandards',     label: 'Product Standards' },
  { key: 'buyerUpgrades',        label: 'Buyer Upgrades' },
  { key: 'revisionsAfterLaunch', label: 'Revisions After Launch' },
  { key: 'notes',                label: 'Notes' },
] as const

const MULTI_FAMILY_OPTIONAL_FIELDS = [
  { key: 'notes', label: 'Notes' },
] as const

function parseVisibleFields(raw: string): Set<string> {
  if (!raw) return new Set(SINGLE_FAMILY_OPTIONAL_FIELDS.map(f => f.key))
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string; proposalId: string }>()
  const clientId = Number(params.id)
  const proposalId = Number(params.proposalId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposal', clientId, proposalId],
    queryFn:  () => proposalApi.getById(clientId, proposalId),
  })

  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries', clientId],
    queryFn:  () => libraryApi.getForClient(clientId),
  })

  const { data: upgrades = [] } = useQuery({
    queryKey: ['custom-upgrades', clientId],
    queryFn:  () => customUpgradeApi.getForClient(clientId),
  })

  // ── Local form state ──────────────────────────────────────────────────────
  const [name, setName]                         = useState('')
  const [status, setStatus]                     = useState<ProposalStatus>('Draft')
  const [deadline, setDeadline]                 = useState('')
  const [deadlineReminderDays, setDeadlineReminderDays] = useState(2)
  const [notes, setNotes]                       = useState('')
  const [visibleFields, setVisibleFields]       = useState<Set<string>>(new Set())
  const [libraryId, setLibraryId]               = useState<number | null>(null)
  const [address, setAddress]                   = useState('')
  const [city, setCity]                         = useState('')
  const [productStandards, setProductStandards] = useState('')
  const [version, setVersion]                   = useState('')
  const [buyerUpgrades, setBuyerUpgrades]       = useState('')
  const [revisionsAfterLaunch, setRevisionsAfterLaunch] = useState('')
  const [buildings, setBuildings]               = useState<ProposalBuildingInput[]>([])
  const [upgradeToggles, setUpgradeToggles]     = useState<Map<number, boolean>>(new Map())
  const [convertOpen, setConvertOpen]           = useState(false)
  const [fieldsConfigOpen, setFieldsConfigOpen] = useState(false)

  useEffect(() => {
    if (!proposal) return
    setName(proposal.name)
    setStatus(proposal.status === 'Converted' ? 'Accepted' : proposal.status)
    setDeadline(proposal.deadline ? proposal.deadline.slice(0, 10) : '')
    setDeadlineReminderDays(proposal.deadlineReminderDays)
    setNotes(proposal.notes)
    setVisibleFields(parseVisibleFields(proposal.visibleFields))
    setLibraryId(proposal.libraryId)
    setAddress(proposal.address)
    setCity(proposal.city)
    setProductStandards(proposal.productStandards)
    setVersion(proposal.version)
    setBuyerUpgrades(proposal.buyerUpgrades)
    setRevisionsAfterLaunch(proposal.revisionsAfterLaunch)
    setBuildings(proposal.buildings.map(b => ({
      id: b.id,
      name: b.name,
      plans: b.plans.map(p => ({
        id: p.id,
        planName: p.planName,
        squareFootage: p.squareFootage,
        amount: p.amount,
      })),
    })))
    const map = new Map<number, boolean>()
    proposal.customUpgrades.forEach(u => map.set(u.customUpgradeId, u.isEnabled))
    setUpgradeToggles(map)
  }, [proposal])

  const saveMut = useMutation({
    mutationFn: () => {
      const customUpgradesPayload: ProposalUpgradeInput[] = upgrades.map(u => ({
        customUpgradeId: u.id,
        isEnabled: upgradeToggles.get(u.id) ?? false,
      }))
      return proposalApi.update(clientId, proposalId, {
        name: name.trim(),
        status,
        deadline: deadline || null,
        deadlineReminderDays,
        notes,
        visibleFields: Array.from(visibleFields).join(','),
        libraryId,
        address,
        city,
        productStandards,
        version,
        buyerUpgrades,
        revisionsAfterLaunch,
        buildings: proposal?.type === 'MultiFamily' ? buildings : null,
        customUpgrades: customUpgradesPayload,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      qc.invalidateQueries({ queryKey: ['proposals', clientId] })
      qc.invalidateQueries({ queryKey: ['all-proposals'] })
      toast.success('Proposal saved')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data ?? 'Save failed')
    },
  })

  const convertMut = useMutation({
    mutationFn: () => proposalApi.convert(clientId, proposalId),
    onSuccess: (result) => {
      toast.success('Proposal converted to project')
      qc.invalidateQueries({ queryKey: ['proposals', clientId] })
      navigate(`/projects/${result.projectId}`)
    },
    onError: (err: any) => {
      const msg = err?.response?.data ?? 'Conversion failed'
      toast.error(typeof msg === 'string' ? msg : 'Conversion failed')
    },
  })

  // ── Total sqft for pricing auto-compute ───────────────────────────────────
  const totalSqFt = useMemo(() => {
    if (!proposal) return 0
    if (proposal.type === 'MultiFamily') {
      return proposal.buildings.reduce((sum, b) =>
        sum + b.plans.reduce((s, p) => s + p.squareFootage, 0), 0)
    }
    return 0
  }, [proposal])

  if (isLoading || !proposal) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  const isLocked = proposal.status === 'Converted'
  const canConvert = proposal.status === 'Accepted' && !proposal.convertedProjectId

  const optionalFields = proposal.type === 'SingleFamily'
    ? SINGLE_FAMILY_OPTIONAL_FIELDS
    : MULTI_FAMILY_OPTIONAL_FIELDS

  // ── Building helpers ──────────────────────────────────────────────────────
  function setBuildingName(idx: number, value: string) {
    setBuildings(prev => prev.map((b, i) => i === idx ? { ...b, name: value } : b))
  }
  function addBuilding() {
    setBuildings(prev => [...prev, { id: null, name: '', plans: [] }])
  }
  function removeBuilding(idx: number) {
    setBuildings(prev => prev.filter((_, i) => i !== idx))
  }
  function addPlan(buildingIdx: number) {
    setBuildings(prev => prev.map((b, i) =>
      i === buildingIdx
        ? { ...b, plans: [...b.plans, { id: null, planName: '', squareFootage: 0, amount: 0 }] }
        : b
    ))
  }
  function updatePlan(buildingIdx: number, planIdx: number, patch: Partial<{ planName: string; squareFootage: number; amount: number }>) {
    setBuildings(prev => prev.map((b, i) =>
      i === buildingIdx
        ? { ...b, plans: b.plans.map((p, j) => j === planIdx ? { ...p, ...patch } : p) }
        : b
    ))
  }
  function removePlan(buildingIdx: number, planIdx: number) {
    setBuildings(prev => prev.map((b, i) =>
      i === buildingIdx
        ? { ...b, plans: b.plans.filter((_, j) => j !== planIdx) }
        : b
    ))
  }

  function toggleUpgrade(id: number, enabled: boolean) {
    setUpgradeToggles(prev => {
      const next = new Map(prev)
      next.set(id, enabled)
      return next
    })
  }

  function toggleField(key: string) {
    setVisibleFields(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to={`/clients/${clientId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Client
        </Link>
        <div className="flex items-center gap-2">
          {isLocked && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400">
              Converted
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!canConvert}
            onClick={() => setConvertOpen(true)}
            title={!canConvert ? 'Proposal must be in Accepted status to convert' : undefined}
          >
            <ArrowRightCircle className="mr-1 h-3.5 w-3.5" /> Convert to Project
          </Button>
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={isLocked || saveMut.isPending}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {proposal.type === 'SingleFamily' ? 'Single Family Proposal' : 'Multi Family Proposal'}
            </h2>
            <Badge variant="outline">{proposal.status}</Badge>
          </div>
        </div>
      </div>

      {/* Header fields: Name, Status, Deadline */}
      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as ProposalStatus)} disabled={isLocked}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Deadline</Label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reminder (days before)</Label>
            <Input
              type="number"
              min={0}
              value={deadlineReminderDays}
              onChange={e => setDeadlineReminderDays(Number(e.target.value) || 0)}
              className="h-8 text-sm"
              disabled={isLocked}
            />
          </div>
        </div>
      </div>

      {/* PDF Attachment */}
      <PdfSection clientId={clientId} proposalId={proposalId} proposal={proposal} isLocked={isLocked} />

      {/* Field visibility config */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setFieldsConfigOpen(true)} disabled={isLocked}>
          <Pencil className="h-3 w-3 mr-1" /> Configure visible fields
        </Button>
      </div>

      {fieldsConfigOpen && (
        <Dialog open onOpenChange={o => !o && setFieldsConfigOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Visible Fields</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {optionalFields.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={visibleFields.has(f.key)} onChange={() => toggleField(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setFieldsConfigOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Type-specific fields */}
      {proposal.type === 'SingleFamily' ? (
        <div className="rounded-md border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Single Family Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Library <span className="text-destructive">*</span></Label>
              <Select
                value={libraryId !== null ? String(libraryId) : ''}
                onValueChange={v => setLibraryId(v ? Number(v) : null)}
                disabled={isLocked}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a library…" />
                </SelectTrigger>
                <SelectContent>
                  {libraries.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version</Label>
              <Input value={version} onChange={e => setVersion(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
            </div>
          </div>
          {visibleFields.has('productStandards') && (
            <div className="space-y-1">
              <Label className="text-xs">Product Standards</Label>
              <Input value={productStandards} onChange={e => setProductStandards(e.target.value)} className="h-8 text-sm" disabled={isLocked} />
            </div>
          )}
          {visibleFields.has('buyerUpgrades') && (
            <div className="space-y-1">
              <Label className="text-xs">Buyer Upgrades</Label>
              <Textarea value={buyerUpgrades} onChange={e => setBuyerUpgrades(e.target.value)} className="text-sm" rows={3} disabled={isLocked} />
            </div>
          )}
          {visibleFields.has('revisionsAfterLaunch') && (
            <div className="space-y-1">
              <Label className="text-xs">Revisions After Launch</Label>
              <Textarea value={revisionsAfterLaunch} onChange={e => setRevisionsAfterLaunch(e.target.value)} className="text-sm" rows={3} disabled={isLocked} />
            </div>
          )}
          {visibleFields.has('notes') && (
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-sm" rows={4} disabled={isLocked} />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Buildings</h3>
              <Button variant="outline" size="sm" onClick={addBuilding} disabled={isLocked}>
                <Plus className="mr-1 h-3 w-3" /> Add Building
              </Button>
            </div>
            {buildings.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No buildings yet.</p>
            ) : (
              <div className="space-y-3">
                {buildings.map((b, bi) => (
                  <div key={bi} className="rounded-md border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={b.name} onChange={e => setBuildingName(bi, e.target.value)} placeholder="Building name" className="h-8 text-sm flex-1" disabled={isLocked} />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeBuilding(bi)} disabled={isLocked}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 pl-3">
                      {b.plans.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">No plans.</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <div className="col-span-5">Plan name</div>
                            <div className="col-span-3">Sq Ft</div>
                            <div className="col-span-3">Price</div>
                            <div className="col-span-1" />
                          </div>
                          {b.plans.map((p, pi) => (
                            <div key={pi} className="grid grid-cols-12 gap-2 items-center">
                              <Input value={p.planName} onChange={e => updatePlan(bi, pi, { planName: e.target.value })} className="col-span-5 h-7 text-xs" disabled={isLocked} />
                              <Input type="number" value={p.squareFootage} onChange={e => updatePlan(bi, pi, { squareFootage: Number(e.target.value) || 0 })} className="col-span-3 h-7 text-xs" disabled={isLocked} />
                              <Input type="number" step="0.01" value={p.amount} onChange={e => updatePlan(bi, pi, { amount: Number(e.target.value) || 0 })} className="col-span-3 h-7 text-xs" disabled={isLocked} />
                              <Button variant="ghost" size="sm" className="col-span-1 h-6 w-6 p-0 text-destructive" onClick={() => removePlan(bi, pi)} disabled={isLocked}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addPlan(bi)} disabled={isLocked}>
                        <Plus className="mr-1 h-3 w-3" /> Add Plan
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Notes for multi-family */}
          {visibleFields.has('notes') && (
            <div className="rounded-md border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Notes</h3>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-sm" rows={4} disabled={isLocked} />
            </div>
          )}
        </>
      )}

      {/* Custom Upgrades */}
      <div className="rounded-md border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Custom Upgrades</h3>
          <p className="text-xs text-muted-foreground">
            Toggle which upgrades apply to this proposal. Manage the catalog from the client's Options tab.
          </p>
        </div>
        {upgrades.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No custom upgrades configured for this client.</p>
        ) : (
          <div className="space-y-1">
            {upgrades.map(u => {
              const enabled = upgradeToggles.get(u.id) ?? false
              return (
                <label key={u.id} className="flex items-center justify-between rounded border bg-muted/10 px-3 py-2 cursor-pointer hover:bg-muted/30">
                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={enabled} onChange={e => toggleUpgrade(u.id, e.target.checked)} disabled={isLocked} />
                    <span className="font-medium">{u.name}</span>
                    {u.isGlobal && <span className="rounded bg-blue-100 text-blue-800 px-1 text-[10px]">GLOBAL</span>}
                    {u.description && <span className="text-xs text-muted-foreground">— {u.description}</span>}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Pricing History */}
      <PricingSection clientId={clientId} proposalId={proposalId} pricings={proposal.pricings} totalSqFt={totalSqFt} isLocked={isLocked} />

      {convertOpen && (
        <Dialog open onOpenChange={(o) => !o && setConvertOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert proposal to project?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>This will create a new project under this client and copy all proposal data over.</p>
              {proposal.type === 'MultiFamily' && (
                <p className="text-xs text-muted-foreground">
                  Each building's plans will be created on the project. Lots can be added later and assigned to plans
                  via the Buildings &amp; Lots tab on the project.
                </p>
              )}
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Once converted, this proposal becomes read-only. It will be hidden from the default Proposals view but
                  remain accessible via "Show converted".
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConvertOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                {convertMut.isPending ? 'Converting…' : 'Convert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── PDF Section ─────────────────────────────────────────────────────────────

function PdfSection({ clientId, proposalId, proposal, isLocked }: {
  clientId: number
  proposalId: number
  proposal: { pdfFileName: string | null; pdfContentLength: number }
  isLocked: boolean
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: (file: File) => proposalApi.uploadPdf(clientId, proposalId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      toast.success('PDF uploaded')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? err?.response?.data ?? 'Upload failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => proposalApi.deletePdf(clientId, proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      toast.success('PDF removed')
    },
    onError: () => toast.error('Failed to remove PDF'),
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMut.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold">PDF Attachment</h3>
      {proposal.pdfFileName ? (
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <a
            href={proposalApi.downloadPdfUrl(clientId, proposalId)}
            target="_blank"
            rel="noopener"
            className="text-sm text-blue-600 hover:underline truncate"
          >
            {proposal.pdfFileName}
          </a>
          <span className="text-xs text-muted-foreground">
            ({(proposal.pdfContentLength / 1024).toFixed(0)} KB)
          </span>
          {!isLocked && (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}>
                <Upload className="h-3 w-3 mr-1" /> Replace
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground italic">No PDF attached.</p>
          {!isLocked && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}>
              <Upload className="h-3 w-3 mr-1" /> {uploadMut.isPending ? 'Uploading…' : 'Upload PDF'}
            </Button>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ── Pricing History Section ─────────────────────────────────────────────────

function PricingSection({ clientId, proposalId, pricings, totalSqFt, isLocked }: {
  clientId:   number
  proposalId: number
  pricings:   ProposalPricing[]
  totalSqFt:  number
  isLocked:   boolean
}) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [label, setLabel]                 = useState('')
  const [pricePerSqFt, setPricePerSqFt]   = useState('')
  const [totalAmount, setTotalAmount]     = useState('')
  const [pricingNotes, setPricingNotes]   = useState('')
  const [totalOverridden, setTotalOverridden] = useState(false)

  function resetForm() {
    setLabel(''); setPricePerSqFt(''); setTotalAmount(''); setPricingNotes('')
    setTotalOverridden(false); setAdding(false); setEditId(null)
  }

  function startEdit(p: ProposalPricing) {
    setEditId(p.id)
    setLabel(p.label)
    setPricePerSqFt(String(p.pricePerSqFt))
    setTotalAmount(String(p.totalAmount))
    setPricingNotes(p.notes)
    setTotalOverridden(true)
    setAdding(true)
  }

  function handlePricePerSqFtChange(val: string) {
    setPricePerSqFt(val)
    if (!totalOverridden && totalSqFt > 0) {
      const computed = (Number(val) || 0) * totalSqFt
      setTotalAmount(computed ? computed.toFixed(2) : '')
    }
  }

  function handleTotalAmountChange(val: string) {
    setTotalAmount(val)
    setTotalOverridden(true)
  }

  const createMut = useMutation({
    mutationFn: (data: CreateProposalPricingRequest) =>
      proposalApi.createPricing(clientId, proposalId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      toast.success('Pricing added')
      resetForm()
    },
    onError: () => toast.error('Failed to add pricing'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateProposalPricingRequest }) =>
      proposalApi.updatePricing(clientId, proposalId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      toast.success('Pricing updated')
      resetForm()
    },
    onError: () => toast.error('Failed to update pricing'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => proposalApi.deletePricing(clientId, proposalId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', clientId, proposalId] })
      toast.success('Pricing removed')
    },
    onError: () => toast.error('Failed to remove pricing'),
  })

  function handleSave() {
    const data: CreateProposalPricingRequest = {
      label: label.trim(),
      pricePerSqFt: Number(pricePerSqFt) || 0,
      totalAmount:  Number(totalAmount) || 0,
      notes: pricingNotes || null,
    }
    if (editId) updateMut.mutate({ id: editId, data })
    else createMut.mutate(data)
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pricing History</h3>
          {totalSqFt > 0 && (
            <p className="text-xs text-muted-foreground">
              Total Sq Ft from plans: {totalSqFt.toLocaleString()}
            </p>
          )}
        </div>
        {!isLocked && !adding && (
          <Button variant="outline" size="sm" onClick={() => { resetForm(); setAdding(true) }}>
            <Plus className="mr-1 h-3 w-3" /> Add Pricing
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Option A" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price / Sq Ft</Label>
              <Input type="number" step="0.01" value={pricePerSqFt} onChange={e => handlePricePerSqFtChange(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total Amount {totalSqFt > 0 && !totalOverridden && <span className="text-muted-foreground">(auto)</span>}</Label>
              <Input type="number" step="0.01" value={totalAmount} onChange={e => handleTotalAmountChange(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={pricingNotes} onChange={e => setPricingNotes(e.target.value)} className="text-sm" rows={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? 'Update' : 'Add'}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {pricings.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground italic">No pricing entries yet.</p>
      ) : pricings.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-2">
            <div className="col-span-3">Label</div>
            <div className="col-span-2">Price/SqFt</div>
            <div className="col-span-2">Total</div>
            <div className="col-span-3">Notes</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-1" />
          </div>
          {pricings.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-2 items-center rounded px-2 py-1.5 hover:bg-muted/30 text-sm">
              <div className="col-span-3 font-medium truncate">{p.label || '—'}</div>
              <div className="col-span-2">${p.pricePerSqFt.toFixed(2)}</div>
              <div className="col-span-2">${p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="col-span-3 text-xs text-muted-foreground truncate">{p.notes || '—'}</div>
              <div className="col-span-1 text-xs text-muted-foreground">
                {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="col-span-1 flex gap-1 justify-end">
                {!isLocked && (
                  <>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMut.mutate(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
