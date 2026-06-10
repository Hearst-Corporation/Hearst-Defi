import { LoginForm } from "@/components/auth/login-form";

/**
 * LoginPanel — right column of the S0 landing / login split-screen.
 *
 * Pendant symétrique du MarketingPanel (à gauche) :
 *   - même eyebrow (.eyebrow accent)
 *   - même H1 (.h1 cockpit)
 *   - même sous-titre body-sm
 *   - même disclaimer body-xs
 *   - même rythme vertical (gap entre blocs)
 *
 * Privy est volontairement absent — auth = email/password DB. Wallet connect
 * (Privy) arrive plus tard dans le flow d'abonnement USDC.
 */
export function LoginPanel() {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-sm gap-[var(--ct-space-8)]">
      <header className="flex flex-col items-center gap-[var(--ct-space-3)]">
        <p className="body-sm ct-text-accent font-medium">
          Access your vaults and portfolio
        </p>
      </header>

      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
