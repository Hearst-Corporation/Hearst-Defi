import type { Metadata } from "next";
import Link from "next/link";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { getIrContact } from "@/lib/ir-contact";

export const metadata: Metadata = {
  title: "Application received — Hearst Connect",
  robots: { index: false, follow: false },
};

export default function ConfirmedPage() {
  const irContact = getIrContact();

  return (
    <OnboardingChamber
      testId="apply-confirmed"
      crown={
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Hearst Connect · Application
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7FB90]/20 bg-[#A7FB90]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#A7FB90]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#A7FB90]" />
              Received
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] leading-[28px] font-medium text-white tracking-tight text-pretty">
              Application <span className="text-[#A7FB90]">received</span>
            </h1>
            <p className="text-[13px] text-zinc-400 leading-relaxed text-pretty">
              Thank you. We&apos;ve emailed you an activation link to set your
              password and access your investor cockpit — check your inbox now.
            </p>
          </div>
        </div>
      }
      body={
        <div className="flex flex-col gap-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#A7FB90]/40 bg-[#A7FB90]/10 text-[#A7FB90]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              className="shrink-0"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              What to expect
            </h2>
            <p className="text-[13px] text-zinc-400 leading-relaxed text-pretty">
              Check your inbox now for the activation link to set your password —
              you&rsquo;ll be signed in automatically and taken straight to your
              cockpit. Have a question in the meantime? Reach out to Investor
              Relations any time.
            </p>
          </div>
        </div>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          actions={
            <div className="flex flex-col gap-2">
              <p className="m-0 text-center text-[13px] text-zinc-400 leading-relaxed text-pretty">
                Your activation link is on its way. Once you set your password
                you&apos;ll be signed in automatically — no need to come back here.
              </p>
              <p className="m-0 text-center text-[12px] text-zinc-500 leading-relaxed text-pretty">
                Didn&apos;t receive the email?{" "}
                <Link
                  href="/forgot-password"
                  className="font-medium text-[#A7FB90] hover:underline"
                >
                  Request a new activation link
                </Link>
                .
              </p>
            </div>
          }
          compliance={
            <>Institutional USDC yield. For qualified investors only. Cayman SPV structure.</>
          }
        />
      }
    />
  );
}
