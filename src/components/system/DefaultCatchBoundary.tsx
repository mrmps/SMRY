import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="text-3xl font-semibold">We hit a snag</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
