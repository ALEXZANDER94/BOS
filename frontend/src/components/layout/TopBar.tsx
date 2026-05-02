import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import axios from 'axios'

interface TopBarProps {
  user: { name: string; email: string }
}

export default function TopBar({ user }: TopBarProps) {
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: () => axios.post('/api/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
    },
  })

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      {/* Left side: could hold breadcrumbs in future */}
      <div />

      {/* Right side: notifications + user info + logout */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />

        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{user.name}</span>
          <span className="hidden text-muted-foreground sm:inline">· {user.email}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="gap-1.5"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
