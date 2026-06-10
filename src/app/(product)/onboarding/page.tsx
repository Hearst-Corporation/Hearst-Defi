import { redirect } from "next/navigation";

// The onboarding funnel starts at the accreditation step (there is no standalone
// /onboarding landing). Redirect the bare index there so it never 404s.
export default function OnboardingIndexPage() {
  redirect("/onboarding/accreditation");
}
