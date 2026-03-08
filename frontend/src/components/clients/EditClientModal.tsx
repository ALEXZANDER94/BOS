import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import type { Client } from '@/api/clients'

interface EditClientModalProps {
  client:  Client
  onClose: () => void
}

export default function EditClientModal({ client, onClose }: EditClientModalProps) {
  const updateClient = useUpdateClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: {
      name:        client.name,
      description: client.description,
      status:      client.status as 'Active' | 'Inactive',
      industry:    client.industry,
      website:     client.website,
      domain:      client.domain,
      street:      client.street,
      city:        client.city,
      state:       client.state,
      zip:         client.zip,
    },
  })

  useEffect(() => {
    reset({
      name:        client.name,
      description: client.description,
      status:      client.status as 'Active' | 'Inactive',
      industry:    client.industry,
      website:     client.website,
      domain:      client.domain,
      street:      client.street,
      city:        client.city,
      state:       client.state,
      zip:         client.zip,
    })
  }, [client, reset])

  const statusValue = watch('status')

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

          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || updateClient.isPending}>
              {updateClient.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
