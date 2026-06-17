import type { Metadata } from "next";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply — Hearst Connect",
  description:
    "Qualify for access to Hearst Connect — institutional USDC yield, mining-backed structured product.",
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  return <ApplyForm />;
}
