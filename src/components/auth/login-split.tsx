import Image from "next/image";

import { LoginPanel } from "@/components/auth/login-panel";

import "@/app/auth.css";

export function LoginSplit() {
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

        <section
          className="login-split__brand auth-split__brand-inset relative"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
