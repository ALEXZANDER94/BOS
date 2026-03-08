import axios from 'axios'

export interface ComparisonResult {
  catalogNumber:      string
  description:        string
  mfr:                string   // Manufacturer — extracted from match-key cell via Format template
  masterPrice:        number   // Per-unit contracted price from master glossary
  proposedPrice:      number   // Per-unit price from invoice (rounded to 2 dp, for display)
  dollarDifference:   number   // ProposedTotal − (masterPrice × proposedQuantity)
  percentDifference:  number   // dollarDifference / expectedTotal × 100
  isOverpriced:       boolean  // ProposedTotal > (masterPrice × proposedQuantity)
  isNewItem:          boolean
  isNeedsReview:      boolean  // true when the criteria cell couldn't be auto-parsed
  rawCriteriaCell:    string   // original combined cell text (populated when isNeedsReview)
  proposedQuantity:   number   // Number of units on the invoice line (default 1)
  proposedTotal:      number   // Actual invoice line total (from ColTotal column; 0 if not mapped)
  invoiceNumber:      string   // Invoice number (from ColInvoiceNumber column; "" if not mapped)
}

// ── Shared column-mapping dialog types ───────────────────────────────────────

export interface CandidateHeaderRow {
  rowNumber: number
  headers:   string[]
}

/** Shape shared by both AdobeHeadersResult and SpreadsheetHeadersResult for the mapping dialog. */
export interface ColumnMappingResult {
  sessionToken:                string
  candidateRows:               CandidateHeaderRow[]
  suggestedRowNumber:          number
  suggestedMatchColumn:        string | null
  suggestedPriceColumn:        string | null
  suggestedDescriptionColumn:  string | null
  suggestedQuantityColumn:     string | null
  suggestedTotalColumn:        string | null
  suggestedInvoiceNumberColumn: string | null
}

// ── Adobe two-step flow types ─────────────────────────────────────────────────

export type AdobeHeadersResult = ColumnMappingResult

export interface ConfirmAdobeRequest {
  sessionToken:    string
  supplierId:      number
  headerRowNumber: number
  matchColumn:     string
  colPrice:        string
  colDescription:  string | null
  colQuantity:     string | null
  colTotal:        string | null
  colInvoiceNumber: string | null
  saveToSupplier:  boolean
}

// ── Spreadsheet two-step flow types ──────────────────────────────────────────

/** Returned by scan-spreadsheet-headers. fileExtension is for internal tracking only. */
export interface SpreadsheetHeadersResult extends ColumnMappingResult {
  fileExtension: string
}

export interface ConfirmSpreadsheetRequest {
  sessionToken:    string
  supplierId:      number
  headerRowNumber: number
  matchColumn:     string
  colPrice:        string
  colDescription:  string | null
  colQuantity:     string | null
  colTotal:        string | null
  colInvoiceNumber: string | null
  saveToSupplier:  boolean
}

// ─────────────────────────────────────────────────────────────────────────────

export const comparisonApi = {
  /**
   * Parse an Excel (.xlsx) or CSV (.csv) file and compare against master glossary.
   * Does not require Adobe PDF Services.
   * @deprecated Use scanSpreadsheetHeaders + confirmSpreadsheet for the full two-step flow.
   */
  uploadSpreadsheet: (supplierId: number, file: File): Promise<ComparisonResult[]> => {
    const form = new FormData()
    form.append('file', file)
    return axios
      .post<ComparisonResult[]>(`/api/comparison/upload-spreadsheet?supplierId=${supplierId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  /**
   * Step 1 of the two-step PDF upload flow.
   * Converts the PDF via Adobe PDF Services, caches the resulting XLSX to a temp
   * file on the server, scans for candidate header rows, and returns a session
   * token + suggested column mapping.
   * Adobe PDF Services must be configured in Settings.
   */
  scanAdobeHeaders: (supplierId: number, file: File): Promise<AdobeHeadersResult> => {
    const form = new FormData()
    form.append('file', file)
    return axios
      .post<AdobeHeadersResult>(`/api/comparison/scan-adobe-headers?supplierId=${supplierId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Adobe conversion can take 10-30 seconds for large PDFs
        timeout: 120_000,
      })
      .then(r => r.data)
  },

  /**
   * Step 2 of the two-step PDF upload flow.
   * Sends the user's confirmed column mapping to the server.  The server loads
   * the cached XLSX, parses it with the specified header row, runs the comparison,
   * and (optionally) saves the mapping back to the supplier's criteria.
   */
  confirmAdobe: (request: ConfirmAdobeRequest): Promise<ComparisonResult[]> =>
    axios
      .post<ComparisonResult[]>('/api/comparison/confirm-adobe', request)
      .then(r => r.data),

  /**
   * Step 1 of the two-step spreadsheet upload flow.
   * Caches the XLSX/CSV to a temp file, scans candidate header rows, and returns
   * a session token + suggested column mapping derived from saved criteria.
   */
  scanSpreadsheetHeaders: (supplierId: number, file: File): Promise<SpreadsheetHeadersResult> => {
    const form = new FormData()
    form.append('file', file)
    return axios
      .post<SpreadsheetHeadersResult>(
        `/api/comparison/scan-spreadsheet-headers?supplierId=${supplierId}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(r => r.data)
  },

  /**
   * Step 2 of the two-step spreadsheet upload flow.
   * Sends the user's confirmed column mapping. The server loads the cached file,
   * parses it, runs the comparison, and optionally saves the mapping.
   */
  confirmSpreadsheet: (request: ConfirmSpreadsheetRequest): Promise<ComparisonResult[]> =>
    axios
      .post<ComparisonResult[]>('/api/comparison/confirm-spreadsheet', request)
      .then(r => r.data),

  /**
   * Generate a PDF report from comparison results.
   * By default only overpriced items are included. Pass includeNewItems=true to
   * also include new/unknown items.
   */
  generateReport: (results: ComparisonResult[], includeNewItems = false) =>
    axios
      .post(`/api/comparison/report?includeNewItems=${includeNewItems}`, results, { responseType: 'blob' })
      .then(r => r.data as Blob),
}
