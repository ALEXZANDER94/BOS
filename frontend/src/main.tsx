import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import './index.css'
import App from './App.tsx'

// QueryClient is the central cache for all server state in the app.
// staleTime: data is considered fresh for 30s before a background refetch.
// retry: only retry failed requests once (avoids hammering a down server).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          {/* Toaster renders toast notifications at the corner of the screen */}
          <Toaster richColors position="top-right" />
        </BrowserRouter>
        {/* DevTools panel — only visible in development builds */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
