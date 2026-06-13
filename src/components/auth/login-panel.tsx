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
    <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
      <header className="flex flex-col items-center gap-3">
        <span className="eyebrow ct-text-muted">Investor access</span>
        <h2 className="h2 m-0">Sign in</h2>
        <p className="body-sm ct-text-muted">
          Access your vaults and portfolio
        </p>
      </header>

      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
