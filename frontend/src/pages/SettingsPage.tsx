import { useState } from 'react'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdobeSettings, useClearAdobeCredentials } from '@/hooks/useAdobeSettings'
import ConnectAdobeModal from '@/components/settings/ConnectAdobeModal'

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isAvailable }: { isAvailable: boolean }) {
  if (isAvailable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3" />
      Not Configured
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: status, isLoading } = useAdobeSettings()
  const clearCreds = useClearAdobeCredentials()
  const [showConnectModal, setShowConnectModal] = useState(false)

  const isConnected = status?.isAvailable ?? false

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure application-wide preferences and connected services.
        </p>
      </div>

      {/* Adobe PDF Services section */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Adobe PDF Services</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Used to convert complex supplier PDFs to Excel when the built-in parser
              cannot extract the data correctly.
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : status ? (
            <StatusBadge isAvailable={isConnected} />
          ) : null}
        </div>

        {/* Conversion count — shown when credentials are configured */}
        {!isLoading && isConnected && (status?.monthlyCount ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            {status!.monthlyCount} conversion{status!.monthlyCount !== 1 ? 's' : ''} completed this month.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!isLoading && (
            <Button
              variant={isConnected ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowConnectModal(true)}
            >
              {isConnected ? 'Update Credentials' : 'Configure Credentials'}
            </Button>
          )}

          {/* Remove — only shown when credentials are stored in the database */}
          {!isLoading && isConnected && status?.isPro && (
            <Button
              variant="ghost"
              size="sm"
              disabled={clearCreds.isPending}
              onClick={() => clearCreds.mutate()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {clearCreds.isPending ? 'Removing…' : 'Remove Credentials'}
            </Button>
          )}

          <a
            href="https://developer.adobe.com/document-services/docs/overview/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Get free API credentials
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Not configured help text */}
        {!isLoading && !isConnected && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Adobe PDF Services credentials are not yet configured. Click{' '}
            <strong>Configure Credentials</strong> above and enter your Client ID and
            Client Secret from the{' '}
            <a
              href="https://developer.adobe.com/console/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Adobe Developer Console
            </a>
            . Credentials are stored securely in the application database.
          </p>
        )}
      </div>

      {/* Configure modal */}
      {showConnectModal && (
        <ConnectAdobeModal onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  )
}
