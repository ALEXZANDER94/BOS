import { z } from 'zod'

// ── Client ────────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name:        z.string().min(1, 'Name is required'),
  description: z.string().default(''),
  status:      z.enum(['Active', 'Inactive']),
  industry:    z.string().default(''),
  website:     z.string().default(''),
  domain:      z.string().default(''),
  street:      z.string().default(''),
  city:        z.string().default(''),
  state:       z.string().default(''),
  zip:         z.string().default(''),
})

export type ClientFormValues = z.infer<typeof clientSchema>

// ── Contact ───────────────────────────────────────────────────────────────────

export const contactSchema = z.object({
  name:      z.string().min(1, 'Name is required'),
  email:     z.string().email('Enter a valid email').or(z.literal('')).default(''),
  phone:     z.string().default(''),
  title:     z.string().default(''),
  isPrimary: z.boolean().default(false),
})

export type ContactFormValues = z.infer<typeof contactSchema>

// ── Project ───────────────────────────────────────────────────────────────────

export const projectSchema = z.object({
  name:        z.string().min(1, 'Name is required'),
  description: z.string().default(''),
  status:      z.enum(['Active', 'Completed', 'On Hold', 'Cancelled']),
  startDate:   z.string().default(''),
  endDate:     z.string().default(''),
})

export type ProjectFormValues = z.infer<typeof projectSchema>

// ── Activity ──────────────────────────────────────────────────────────────────

export const activitySchema = z.object({
  type:       z.enum(['Call', 'Email', 'Meeting', 'Note']),
  note:       z.string().min(1, 'Note is required'),
  occurredAt: z.string().min(1, 'Date is required'),
})

export type ActivityFormValues = z.infer<typeof activitySchema>
