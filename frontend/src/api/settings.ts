import axios from 'axios'

// ---------------------------------------------------------------------------
// Types — mirrors SettingsController responses exactly.
// ---------------------------------------------------------------------------

export interface AdobeStatus {
  /** "Free" or "Pro" */
  tier:         string
  /** True when Pro credentials are stored in the database */
  isPro:        boolean
  /** True when at least one credential source is configured */
  isAvailable:  boolean
  /** How many conversions have been used this calendar month */
  monthlyCount: number
  /** "yyyy-MM" string for the current tracking month */
  monthYear:    string
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const settingsApi = {
  /** GET /api/settings/adobe — returns current tier, availability, and usage */
  getAdobeStatus: (): Promise<AdobeStatus> =>
    axios.get<AdobeStatus>('/api/settings/adobe').then(r => r.data),

  /** POST /api/settings/adobe/credentials — saves Pro credentials */
  setAdobeCredentials: (clientId: string, clientSecret: string): Promise<void> =>
    axios
      .post('/api/settings/adobe/credentials', { clientId, clientSecret })
      .then(() => {}),

  /** DELETE /api/settings/adobe/credentials — removes Pro credentials */
  clearAdobeCredentials: (): Promise<void> =>
    axios.delete('/api/settings/adobe/credentials').then(() => {}),
}
