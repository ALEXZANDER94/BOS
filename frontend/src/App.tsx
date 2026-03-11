import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import SuppliersPage from '@/pages/SuppliersPage'
import GlossaryPage from '@/pages/GlossaryPage'
import ComparisonPage from '@/pages/ComparisonPage'
import SettingsPage from '@/pages/SettingsPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import EmailsPage from '@/pages/EmailsPage'

interface User {
  name: string
  email: string
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
        {/* Default route redirects to suppliers */}
        <Route path="/" element={<Navigate to="/suppliers" replace />} />
        <Route path="/suppliers"  element={<SuppliersPage />} />
        <Route path="/glossary"   element={<GlossaryPage />} />
        <Route path="/comparison" element={<ComparisonPage />} />
        <Route path="/clients"     element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/projects"     element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/emails"      element={<EmailsPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}
