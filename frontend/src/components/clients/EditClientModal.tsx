import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2, Unlink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { clientSchema, type ClientFormValues } from './clientSchema'
import { useUpdateClient } from '@/hooks/useClients'
import { clientApi, type Client } from '@/api/clients'
import QbCustomerPickerDialog from '@/components/clients/QbCustomerPickerDialog'

interface EditClientModalProps {
  client:  Client
  onClose: () => void
}

export default function EditClientModal({ client, onClose }: EditClientModalProps) {
  const updateClient = useUpdateClient()
  const qc           = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)

  const clearQbCustomerMut = useMutation({
    mutationFn: () => clientApi.setQbCustomer(client.id, null, null),
    onSuccess:  () => {
      toast.success('QuickBooks customer link cleared.')
      qc.invalidateQueries({ queryKey: ['client', client.id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['project-estimates'] })
      qc.invalidateQueries({ queryKey: ['project-invoices'] })
    },
    onError: () => toast.error('Failed to clear customer link.'),
  })

  const initialValues: ClientFormValues = {
    name:          client.name,
    description:   client.description,
    status:        client.status as 'Active' | 'Inactive',
    industry:      client.industry,
    website:       client.website,
    domain:        client.domain,
    street:        client.street,
    city:          client.city,
    state:         client.state,
    zip:           client.zip,
    showContacts:  client.showContacts,
    showProjects:  client.showProjects,
    showProposals: client.showProposals,
    showLibraries: client.showLibraries,
    showActivity:  client.showActivity,
    showOptions:   client.showOptions,
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: initialValues,
  })

  useEffect(() => {
    reset(initialValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, reset])

  const statusValue = watch('status')

  // Tab visibility toggles. Each entry: [form key, label].
  const tabToggles: Array<[
    'showContacts' | 'showProjects' | 'showProposals' | 'showLibraries' | 'showActivity' | 'showOptions',
    string
  ]> = [
    ['showContacts',  'Contacts'],
    ['showProjects',  'Projects'],
    ['showProposals', 'Proposals'],
    ['showLibraries', 'Libraries'],
    ['showActivity',  'Activity Log'],
    ['showOptions',   'Options'],
  ]

  const onSubmit = async (values: ClientFormValues) => {
    await updateClient.mutateAsync({ id: client.id, data: values })
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Client — {client.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-1">

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={statusValue}
                  onValueChange={v => setValue('status', v as 'Active' | 'Inactive')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" {...register('industry')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" {...register('domain')} />
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input {...register('street')} placeholder="Street address" />
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <Input {...register('city')}  placeholder="City" />
                <Input {...register('state')} placeholder="State" />
                <Input {...register('zip')}   placeholder="ZIP" />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div>
                <Label>QuickBooks Customer</Label>
                <p className="text-xs text-muted-foreground">
                  Used to fetch this client's estimates and invoices on each project's
                  Estimates tab. Auto-matched by name on first use.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <div className="flex-1 text-sm">
                  {client.qbCustomerName ? (
                    <>
                      <span className="font-medium">{client.qbCustomerName}</span>
                      {client.qbCustomerId && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          (id: {client.qbCustomerId})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not linked yet</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  {client.qbCustomerName ? 'Re-link' : 'Link'}
                </Button>
                {client.qbCustomerName && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={clearQbCustomerMut.isPending}
                    onClick={() => clearQbCustomerMut.mutate()}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Clear link — auto-match will retry next visit"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label>Visible Tabs</Label>
              <p className="text-xs text-muted-foreground">
                Hide tabs this client doesn't use. The corresponding panels will not be rendered.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {tabToggles.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded border bg-muted/20 px-2 py-1.5 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={watch(key)}
                      onChange={e => setValue(key, e.target.checked, { shouldDirty: true })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || updateClient.isPending}>
              {updateClient.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {pickerOpen && (
        <QbCustomerPickerDialog
          clientId={client.id}
          currentCustomerId={client.qbCustomerId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Dialog>
  )
}
