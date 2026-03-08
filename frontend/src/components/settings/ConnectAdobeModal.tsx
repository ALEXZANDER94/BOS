import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSetAdobeCredentials } from '@/hooks/useAdobeSettings'

interface ConnectAdobeModalProps {
  onClose: () => void
}

export default function ConnectAdobeModal({ onClose }: ConnectAdobeModalProps) {
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const connect = useSetAdobeCredentials()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId.trim() || !clientSecret.trim()) return
    await connect.mutateAsync({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    onClose()
  }

  const isValid = clientId.trim().length > 0 && clientSecret.trim().length > 0

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Adobe PDF Services</DialogTitle>
          <DialogDescription>
            Enter your Adobe PDF Services API credentials to enable PDF-to-Excel conversion.
            You can obtain free credentials from the{' '}
            <a
              href="https://developer.adobe.com/console/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              Adobe Developer Console
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Paste your Client ID here"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="Paste your Client Secret here"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Credentials are stored securely in the local application database and are
                never transmitted anywhere other than Adobe's API.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || connect.isPending}>
              {connect.isPending ? 'Saving…' : 'Save Credentials'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
