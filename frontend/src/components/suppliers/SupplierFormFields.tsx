// Shared form field layout reused by AddSupplierModal and EditSupplierModal.
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SupplierFormValues } from './supplierSchema'

interface SupplierFormFieldsProps {
  register: UseFormRegister<SupplierFormValues>
  errors: FieldErrors<SupplierFormValues>
}

export default function SupplierFormFields({ register, errors }: SupplierFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. Acme Medical Supply" />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="domain">Domain</Label>
        <Input id="domain" {...register('domain')} placeholder="e.g. acmemedical.com" />
        {errors.domain && (
          <p className="text-xs text-destructive">{errors.domain.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" {...register('website')} placeholder="https://www.acmemedical.com" />
        {errors.website && (
          <p className="text-xs text-destructive">{errors.website.message}</p>
        )}
      </div>
    </div>
  )
}
