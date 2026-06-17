import Image from "next/image";

import "../(product)/onboarding/onboarding.css";

export default function ApplyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="onboarding-shell" data-testid="apply-shell">
      <div className="onboarding-shell__frame">
        <header className="onboarding-shell__header">
          <Image
            src="/logos/hearst-connect-dark.svg"
            alt="Hearst Connect"
            width={160}
            height={48}
            className="onboarding-shell__logo"
            priority
          />
        </header>
        <div className="onboarding-shell__stage product-doc product-doc-shell w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
