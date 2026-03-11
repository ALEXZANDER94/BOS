import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAdobeSettings, useClearAdobeCredentials } from '@/hooks/useAdobeSettings'
import ConnectAdobeModal from '@/components/settings/ConnectAdobeModal'
import { quickBooksApi } from '@/api/projects'

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
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const { data: status, isLoading } = useAdobeSettings()
  const clearCreds = useClearAdobeCredentials()
  const [showConnectModal, setShowConnectModal] = useState(false)

  const isConnected = status?.isAvailable ?? false

  // Show toast if redirected back from QB OAuth
  const qbParam = searchParams.get('qb')
  if (qbParam === 'connected') {
    toast.success('QuickBooks connected successfully.')
  } else if (qbParam === 'error') {
    toast.error('QuickBooks connection failed. Please try again.')
  }

  const { data: qbStatus, isLoading: qbLoading } = useQuery({
    queryKey: ['qb-status'],
    queryFn:  () => quickBooksApi.getStatus(),
    staleTime: 30_000,
  })

  const disconnectMut = useMutation({
    mutationFn: () => quickBooksApi.disconnect(),
    onSuccess:  () => {
      toast.success('QuickBooks disconnected.')
      qc.invalidateQueries({ queryKey: ['qb-status'] })
    },
    onError: () => toast.error('Failed to disconnect.'),
  })

  const qbConnected = qbStatus?.connected ?? false

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

      {/* QuickBooks section */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">QuickBooks</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect your QuickBooks Online account to sync purchase order statuses automatically.
            </p>
          </div>
          {qbLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : (
            <StatusBadge isAvailable={qbConnected} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!qbLoading && !qbConnected && (
            <Button
              size="sm"
              onClick={() => { window.location.href = '/api/quickbooks/connect' }}
            >
              Connect QuickBooks
            </Button>
          )}

          {!qbLoading && qbConnected && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disconnectMut.isPending}
              onClick={() => disconnectMut.mutate()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnectMut.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          )}

          <a
            href="https://developer.intuit.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Intuit Developer Console
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {!qbLoading && !qbConnected && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            QuickBooks is not connected. Click <strong>Connect QuickBooks</strong> above to authorise
            via Intuit OAuth. You will need a QuickBooks Online company and an Intuit Developer
            account with a configured app (Client ID and Client Secret set in{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">appsettings.json</code>).
          </p>
        )}
      </div>
    </div>
  )
}
