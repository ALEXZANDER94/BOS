import { z } from 'zod'

// Shared validation schema used by both AddUnitModal and EditUnitModal.
// zod validates on the client before we even hit the API.
export const unitSchema = z.object({
  catalogNumber: z.string().min(1, 'Catalog number is required'),
  description:   z.string().min(1, 'Description is required'),
  mfr:           z.string().min(1, 'MFR is required'),
  // Optional status — null means no status assigned
  statusId:      z.number().nullable().optional(),
  // coerce turns the string from <input type="number"> into a real number.
  // We pipe through z.number() so the inferred type is 'number', not 'unknown'.
  contractedPrice: z.coerce.number().pipe(
    z.number({ error: 'Must be a number' }).positive('Price must be greater than 0')
  ),
  notes: z.string().nullable().optional(),
})

export type UnitFormValues = z.infer<typeof unitSchema>
