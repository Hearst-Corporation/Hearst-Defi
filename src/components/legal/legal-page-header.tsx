/**
 * Legal document page title — uses cockpit `.h1` inside `.legal-body`.
 */
export function LegalPageHeader({ title }: { title: string }) {
  return <h1 className="h1">{title}</h1>;
}
