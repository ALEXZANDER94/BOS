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
import { useCreateClient } from '@/hooks/useClients'

interface AddClientModalProps {
  open:    boolean
  onClose: () => void
}

export default function AddClientModal({ open, onClose }: AddClientModalProps) {
  const createClient = useCreateClient()

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
      name: '', description: '', status: 'Active',
      industry: '', website: '', domain: '',
      street: '', city: '', state: '', zip: '',
    },
  })

  const statusValue = watch('status')

  const onSubmit = async (values: ClientFormValues) => {
    await createClient.mutateAsync(values)
    reset()
    onClose()
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { reset(); onClose() }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-1">

            {/* Name + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Input id="name" {...register('name')} placeholder="Acme Corp" />
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

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} placeholder="Optional notes about this client" />
            </div>

            {/* Industry + Website */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" {...register('industry')} placeholder="e.g. Healthcare" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} placeholder="https://example.com" />
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" {...register('domain')} placeholder="example.com" />
            </div>

            {/* Address */}
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
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createClient.isPending}>
              {createClient.isPending ? 'Adding…' : 'Add Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
