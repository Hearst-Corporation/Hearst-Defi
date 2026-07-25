import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Legal",
  description:
    "Legal documentation for Hearst Connect — institutional RWA yield vault backed by Bitcoin mining cash flows.",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10 lg:px-8">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-border-subtle pb-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground hover:text-accent"
        >
          Hearst Connect
        </Link>
        <nav className="flex gap-5 text-sm" aria-label="Legal documents">
          <Link href="/legal/privacy" className="text-muted hover:text-accent">
            Privacy
          </Link>
          <Link href="/legal/terms" className="text-muted hover:text-accent">
            Terms
          </Link>
          <Link href="/legal/disclaimer" className="text-muted hover:text-accent">
            Disclaimer
          </Link>
        </nav>
      </header>
      <article className="prose prose-invert max-w-none text-sm leading-relaxed text-muted [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-accent [&_a]:text-accent">
        {children}
      </article>
    </div>
  );
}
