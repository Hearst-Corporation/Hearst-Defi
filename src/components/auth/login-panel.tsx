import { LoginForm } from "@/components/auth/login-form";

/**
 * LoginPanel — right column of the S0 landing / login split-screen.
 *
 * Pendant symétrique du MarketingPanel (à gauche) :
 *   - même eyebrow (.eyebrow accent)
 *   - H1 unique côté brand (login-split) ; ce panneau utilise h2 section
 *   - même sous-titre body-sm
 *   - même disclaimer body-xs
 *   - même rythme vertical (gap entre blocs)
 *
 * Privy est volontairement absent — auth = email/password DB. Wallet connect
 * (Privy) arrive plus tard dans le flow d'abonnement USDC.
 */
export function LoginPanel() {
  return (
    <div className="auth-login-panel w-full max-w-sm">
      <h1 className="h1 login-split__title-wrap m-0 self-start text-left">
        Institutional yield, backed by{" "}
        <span className="login-split__title-accent">Bitcoin mining</span>
      </h1>

      <div className="w-full">
        <LoginForm />
      </div>
    </div>
  );
}
