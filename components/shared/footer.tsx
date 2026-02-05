import { Link } from "@/i18n/navigation";

const footerLinks = [
  { label: "Status", href: "https://smry.openstatus.dev/", external: true },
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/changelog" },
  { label: "Contact", href: "https://smryai.userjot.com/", external: true },
];

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-background">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-8">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
        <p className="text-[11px] text-muted-foreground/50">
          © {new Date().getFullYear()} smry
        </p>
      </div>
    </footer>
  );
}
