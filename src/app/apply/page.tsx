import type { Metadata } from "next";

import { getIrContact } from "@/lib/ir-contact";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply — Hearst Connect",
  description:
    "Qualify for access to Hearst Connect — an institutional BTC-accumulation mining note backed by real Bitcoin mining.",
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  const irContact = getIrContact();
  return <ApplyForm irContact={irContact} />;
}
