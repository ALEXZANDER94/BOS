import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  user: { name: string; email: string }
  children: React.ReactNode
}

// AppShell is the persistent frame around every authenticated page.
// Layout: sidebar on the left, header on top-right, main content fills the rest.
export default function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
