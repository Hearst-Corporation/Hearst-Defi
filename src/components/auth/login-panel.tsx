import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";

/**
 * LoginPanel — left column of the login split-screen: logo, brand title, then
 * the email/password sign-in form, all sharing the same left edge. Privy is
 * deliberately absent — auth is email/password DB; wallet connect happens later
 * in the USDC payment flow.
 */
export function LoginPanel() {
  return (
    <div className="auth-login-panel w-full max-w-md items-start text-left">
      <Image
        src="/logos/hearst-connect-dark.svg"
        alt="Hearst Connect"
        width={831}
        height={294}
        className="auth-login-panel__logo"
        priority
      />

      <h1 className="h1 login-split__title-wrap m-0 text-left text-balance">
        Institutional yield, backed by{" "}
        <span className="login-split__title-accent">Bitcoin mining</span>
      </h1>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <h2 className="h2 m-0 text-left">Sign in</h2>
        <LoginForm />
      </div>
    </div>
  );
}
