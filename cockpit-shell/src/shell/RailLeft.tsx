"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useEffect, useState } from "react";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
  setActive,
} from "../stores/activeProductStore";
import {
  subscribe as subLauncher,
  getSnapshot as getLauncher,
  getServerSnapshot as getLauncherSSR,
  set as setLauncher,
} from "../stores/launcherStore";
import { HearstMark } from "./HearstMark";
import { useCockpit } from "./context";

/**
 * Rail gauche — accordéon lanceur de la suite Hearst.
 *
 * - Lanceur OUVERT : rail élargi, tous les produits (hache + nom). Clic produit
 *   → on entre dans le produit, le lanceur se replie.
 * - Lanceur REPLIÉ : rail 88px, en haut le badge du produit actif (sa couleur,
 *   son nom) qui sert de toggle ; reclic → le lanceur se redéploie.
 */
export function RailLeft() {
  const { products, appId, getProduct } = useCockpit();
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const open = useSyncExternalStore(subLauncher, getLauncher, getLauncherSSR);

  const otherProducts = products.filter((p) => p.id !== appId);
  const current = getProduct(active);
  const inProduct = current.id !== appId;

  const label = (name: string) => name.replace(/^Hearst\s+/, "");
  const top = inProduct && !open ? current : getProduct(appId);

  function pick(id: string) {
    setActive(id);
    setLauncher(false);
  }

  return (
    <aside className={`ct-rail-left${open ? " launcher" : ""}`}>
      <button
        type="button"
        className="ct-rail-top"
        title={open ? "Collapse" : `${top.name} — open launcher`}
        aria-label={open ? "Collapse launcher" : "Open launcher"}
        onClick={() => {
          if (inProduct && !open) {
            setActive(appId);
          } else {
            setLauncher(!open);
          }
        }}
        style={{ ["--p-color" as string]: top.color }}
      >
        <span className="ct-rail-top-badge">
          <HearstMark size={34} />
        </span>
        <span className="ct-rail-top-name">{label(top.name)}</span>
      </button>

      {open ? (
        <nav className="ct-rail-list" aria-label="Produits Hearst">
          {otherProducts.map((p) => {
            const on = active === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`ct-rail-row${on ? " active" : ""}`}
                title={p.name}
                aria-pressed={on}
                onClick={() => pick(p.id)}
                style={{ ["--p-color" as string]: p.color }}
              >
                <span className="ct-rail-row-icon">
                  <HearstMark size={24} />
                </span>
                <span className="ct-rail-row-name">{label(p.name)}</span>
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="ct-spacer" />
      )}

      <div className="ct-spacer" />
      <UserBadge appId={appId} />
    </aside>
  );
}

/**
 * Badge utilisateur en bas du rail gauche.
 * Clic → navigue vers /profile (SPA). La déconnexion vit sur /profile
 * (SignOutButton) : un clic involontaire ne peut JAMAIS déconnecter — l'action
 * destructive reste un geste délibéré, et le profil est enfin atteignable via
 * un contrôle dont le titre annonce clairement « Profile & settings ».
 */
function UserBadge({ appId }: { appId: string }) {
  const router = useRouter();
  const [initials, setInitials] = useState<string>("");

  useEffect(() => {
    // Récupère l'email pour les initiales. Import indirect (variable) pour ne
    // PAS forcer @supabase/ssr comme dépendance résolue au typecheck. Les
    // projets qui n'ont pas Supabase (Cortex, Helm, etc.) builderont sans
    // erreur ; ceux qui l'ont auront leurs initiales auto.
    (async () => {
      try {
        const moduleName = "@supabase/ssr";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)(moduleName).catch(() => null);
        if (!mod?.createBrowserClient) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = mod.createBrowserClient(url, key);
        const { data: { user } } = await sb.auth.getUser();
        if (user?.email) setInitials(computeInitials(user.email));
      } catch {
        /* pas de session ou @supabase/ssr absent */
      }
    })();
  }, []);

  const display = initials || (appId || "HC").slice(0, 2).toUpperCase();

  return (
    <div className="ct-rail-identity-stack">
      {/* Avatar = Profil uniquement (navigation SPA). Plus de geste
          « 2e clic = déconnexion » : la déconnexion vit sur /profile, geste
          délibéré, donc aucun clic involontaire ne peut signer out. */}
      <button
        type="button"
        className="ct-avatar"
        title="Profile & settings"
        aria-label="Profile & settings"
        onClick={() => router.push("/profile")}
      >
        {display}
      </button>
    </div>
  );
}

/**
 * Calcule les initiales depuis un email.
 * - "adrien@hearstcorporation.io" → "AH" (1re lettre prénom + 1re lettre domaine)
 * - "john.doe@x.com" → "JD"
 * - fallback : 2 premières lettres du local-part.
 */
function computeInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
