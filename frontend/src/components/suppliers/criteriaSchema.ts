import { z } from 'zod'

// Helper: coerce empty string → null, any other value → number.
// This lets the form treat blank inputs as "not set" (null) rather than NaN.
const nullableNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
  z.number().nullable()
)

export const criteriaSchema = z.object({
  matchColumn: z.string().min(1, 'Required'),
  format:      z.string().min(1, 'Required'),
  colPrice:    z.string().min(1, 'Required'),
  /**
   * Optional X-coordinate override for the match column (in PDF points).
   * Leave blank to let the parser auto-detect from the header phrase position.
   */
  matchColX: nullableNumber,
  /**
   * Optional X-coordinate override for the price column (in PDF points).
   * Leave blank for auto-detect.
   */
  priceColX: nullableNumber,
  /**
   * Optional dedicated Description column header.
   * When set, the parser reads this column's value for the description instead of
   * extracting it from the match-key cell. MFR is always parsed from the Format template.
   */
  colDescription: z.string().optional().transform(v => (v === '' ? null : (v ?? null))),
  /**
   * Optional Quantity column header.
   * Number of units on each invoice line; used with colTotal for total-based comparison.
   */
  colQuantity: z.string().optional().transform(v => (v === '' ? null : (v ?? null))),
  /**
   * Optional Total column header.
   * When set, comparison uses: expectedTotal = masterPricePerUnit × Quantity vs this column.
   */
  colTotal: z.string().optional().transform(v => (v === '' ? null : (v ?? null))),
  /**
   * Optional Invoice Number column header.
   * When set, shown in comparison results and the PDF report.
   */
  colInvoiceNumber: z.string().optional().transform(v => (v === '' ? null : (v ?? null))),
})

export type CriteriaFormValues = z.infer<typeof criteriaSchema>
