import Image from "next/image";
import { Suspense } from "react";

import { listVaults } from "@/lib/data/vaults";
import { Badge } from "@/ui/badge";
import { LoginForm } from "@/views/auth/login-form";

export async function LoginPage() {
  const vaults = await listVaults();
  const vault = vaults.find((v) => v.ticker === "HYV-A") ?? vaults[0];
  const apyRange =
    vault != null ? `${vault.apyLow}–${vault.apyHigh}% estimated range` : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Image
          src="/logos/hearst-connect-dark.svg"
          alt="Hearst Connect"
          width={280}
          height={80}
          className="h-auto w-48"
          priority
        />

        <div className="max-w-md space-y-6">
          <Badge variant="accent">Bitcoin Accumulation Note</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Institutional Bitcoin accumulation, backed by mining
          </h1>
          <p className="text-base leading-relaxed text-muted">
            Real Bitcoin mining accumulates BTC over a 24-month term, delivered at
            maturity. No periodic cash distribution — estimated outcomes are disclosed
            as a range, not guaranteed.
          </p>
          {apyRange ? (
            <p className="text-sm text-subtle">
              Current note target range:{" "}
              <span className="font-medium text-accent-ink">{apyRange}</span>
            </p>
          ) : null}
        </div>

        <p className="text-xs text-subtle">
          Accredited investors only. Not an offer where prohibited.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <Image
              src="/logos/hearst-connect-dark.svg"
              alt="Hearst Connect"
              width={200}
              height={56}
              className="h-auto w-40"
              priority
            />
          </div>

          <header className="space-y-2">
            <p className="hc-eyebrow">Investor access</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="text-sm text-muted">
              Secure access to your portfolio, proofs, and vault activity.
            </p>
          </header>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
