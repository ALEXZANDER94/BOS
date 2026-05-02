import { Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import SuppliersPage from '@/pages/SuppliersPage'
import GlossaryPage from '@/pages/GlossaryPage'
import ComparisonPage from '@/pages/ComparisonPage'
import SettingsPage from '@/pages/SettingsPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ProposalDetailPage from '@/pages/ProposalDetailPage'
import ProposalsPage from '@/pages/ProposalsPage'
import EmailsPage from '@/pages/EmailsPage'
import TicketsPage from '@/pages/TicketsPage'
import TicketDetailPage from '@/pages/TicketDetailPage'
import ToolsPage from '@/pages/ToolsPage'

interface User {
  name:    string
  email:   string
  isAdmin: boolean
}

export default function App() {
  // Check whether the user is authenticated by asking the backend.
  // - While loading: show a neutral loading screen (avoids login flash).
  // - On error (401): show the login page.
  // - On success: render the main app shell with routing.
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => axios.get<User>('/api/auth/me').then(r => r.data),
    retry: false, // Don't retry on 401 — the user is simply not logged in
    staleTime: 5 * 60 * 1000, // Re-check auth at most every 5 minutes
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <AppShell user={user}>
      <Routes>
        <Route path="/"            element={<DashboardPage />} />
        <Route path="/suppliers"   element={<SuppliersPage />} />
        <Route path="/glossary"    element={<GlossaryPage />} />
        <Route path="/comparison"  element={<ComparisonPage />} />
        <Route path="/clients"     element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/clients/:id/proposals/:proposalId" element={<ProposalDetailPage />} />
        <Route path="/proposals"    element={<ProposalsPage />} />
        <Route path="/projects"     element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/emails"       element={<EmailsPage />} />
        <Route path="/tickets"      element={<TicketsPage />} />
        <Route path="/tickets/:id"  element={<TicketDetailPage />} />
        <Route path="/tools"        element={<ToolsPage />} />
        <Route path="/settings"     element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}
