// LoginPage is shown when /api/auth/me returns 401 (not authenticated).
// Clicking "Sign in with Google" hits GET /api/auth/login which issues an
// OAuth2 challenge and redirects the browser to Google's consent screen.
export default function LoginPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="text-center">
        <img src="/bos_main.png" className="object-fit h-full w-full" />
      </div>

      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <p className="mb-4 text-sm text-muted-foreground">
          Sign in with your company Google account to continue.
        </p>
        <button
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => { window.location.href = '/api/auth/login' }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
