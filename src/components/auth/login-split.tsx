import Image from "next/image";

import { LoginPanel } from "@/components/auth/login-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { listVaults } from "@/lib/data/vaults";

import "@/app/auth.css";

export async function LoginSplit() {
  const vaults = await listVaults();
  const vault = vaults.find((v) => v.ticker === "HYV-A") ?? vaults[0];
  const apyRange =
    vault != null ? `${vault.apyLow}-${vault.apyHigh}%` : null;

  return (
    <div className="login-split relative p-0!">
      <div aria-hidden="true" className="login-split__ambient">
        <div className="login-split__glow" />
      </div>

      <div className="login-split__grid grid grid-cols-1 lg:grid-cols-2">
        <section className="login-split__signin auth-split__signin-inset relative">
          <Image
            src="/logos/hearst-connect-dark.svg"
            alt="Hearst Connect"
            width={831}
            height={294}
            className="login-split__signin-logo"
            priority
          />
          <div className="flex w-full justify-center">
            <div className="login-split__signin-card">
              <LoginPanel />
            </div>
          </div>
        </section>

        <section className="login-split__brand auth-split__brand-inset relative">
          <div className="login-split__brand-inner">
            <div className="login-split__tagline">
              <span className="eyebrow login-split__eyebrow-accent">
                Real-World Asset Yield
              </span>

              <h1 className="h1 login-split__title-wrap m-0">
                Institutional yield, backed by{" "}
                <span className="login-split__title-accent">
                  Bitcoin mining
                </span>
              </h1>

              {apyRange != null && (
                <div className="login-split__apy-chip">
                  <span aria-hidden className="login-split__apy-dot" />
                  <span className="eyebrow ct-text-muted">Target APY</span>
                  <span className="body-sm font-semibold ct-text-primary tabular">
                    {apyRange}
                  </span>
                  <ProvenanceBadge kind="estimated" variant="strip" />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
