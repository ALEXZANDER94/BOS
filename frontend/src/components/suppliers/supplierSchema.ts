import { z } from 'zod'

export const supplierSchema = z.object({
  name:    z.string().min(1, 'Name is required'),
  domain:  z.string().min(1, 'Domain is required'),
  website: z.string().min(1, 'Website is required'),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>
