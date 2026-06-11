import Image from "next/image";

import { LoginPanel } from "@/components/auth/login-panel";
import { listVaults } from "@/lib/data/vaults";

export async function LoginSplit() {
  const vaults = await listVaults();
  const vault = vaults.find((v) => v.ticker === "HYV-A") ?? vaults[0];
  const apyRange =
    vault != null ? `${vault.apyLow}–${vault.apyHigh}%` : null;

  return (
    <div className="login-split relative !p-0">
      <div aria-hidden="true" className="login-split__ambient">
        <div className="login-split__glow" />
      </div>

      <div className="login-split__grid grid grid-cols-1 lg:grid-cols-2">
        <section className="login-split__brand relative flex items-start justify-center px-12 lg:px-20">
          <div className="login-split__brand-inner flex flex-col items-center">
            <Image
              src="/logos/hearst-connect-dark.svg"
              alt="Hearst Connect"
              width={831}
              height={294}
              className="login-split__logo"
              priority
            />

            <div className="login-split__tagline">
              <span className="eyebrow login-split__eyebrow-accent">
                Real-World Asset Yield
              </span>

              <h1 className="h1 login-split__title-wrap">
                Institutional yield, backed by{" "}
                <span className="login-split__title-accent">Bitcoin mining</span>
              </h1>

              {apyRange != null && (
                <div className="login-split__apy-chip">
                  <span aria-hidden className="login-split__apy-dot" />
                  <span className="eyebrow ct-text-muted">Target APY</span>
                  <span className="body-sm font-semibold ct-text-primary tabular">
                    {apyRange}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="login-split__signin flex items-start justify-center px-8 sm:px-12">
          <div className="flex w-full justify-center">
            <LoginPanel />
          </div>
        </section>
      </div>
    </div>
  );
}
