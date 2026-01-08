import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="text-center">
        <h1 className="text-8xl font-semibold text-muted-foreground/50">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Page not found
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border-b border-muted-foreground text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
