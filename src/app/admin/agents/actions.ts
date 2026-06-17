"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { BASE_AGENTS, TONES, LANGUAGES, VERBOSITIES } from "@/lib/data/agent-templates";

/** Slugify a label into a stable kebab-case id. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const nullableTrim = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const Input = z.object({
  label: z.string().trim().min(2).max(80),
  description: nullableTrim,
  baseAgent: z.enum(BASE_AGENTS),
  tone: z.enum(TONES).nullable().optional(),
  language: z.enum(LANGUAGES).nullable().optional(),
  verbosity: z.enum(VERBOSITIES).nullable().optional(),
  systemAdditions: nullableTrim,
});

function parse(formData: FormData) {
  const opt = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };
  const parsed = Input.safeParse({
    label: formData.get("label"),
    description: formData.get("description") ?? undefined,
    baseAgent: formData.get("baseAgent"),
    tone: opt("tone"),
    language: opt("language"),
    verbosity: opt("verbosity"),
    systemAdditions: formData.get("systemAdditions") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error("Invalid agent template input");
  }
  // System additions are injected verbatim into a prompt — forbidden-words gate.
  if (parsed.data.systemAdditions) {
    assertNoForbiddenWords(parsed.data.systemAdditions);
  }
  return parsed.data;
}

export async function createAgentTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  const data = parse(formData);

  // Ensure a unique slug (append -2, -3, … on collision).
  const base = slugify(data.label) || "agent";
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await prisma.agentTemplate.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${i}`;
  }

  await prisma.agentTemplate.create({
    data: {
      slug,
      label: data.label,
      description: data.description,
      baseAgent: data.baseAgent,
      tone: data.tone ?? null,
      language: data.language ?? null,
      verbosity: data.verbosity ?? null,
      systemAdditions: data.systemAdditions,
    },
  });

  revalidatePath("/admin/agents");
  redirect("/admin/agents");
}

export async function updateAgentTemplate(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const data = parse(formData);

  await prisma.agentTemplate.update({
    where: { id },
    data: {
      label: data.label,
      description: data.description,
      baseAgent: data.baseAgent,
      tone: data.tone ?? null,
      language: data.language ?? null,
      verbosity: data.verbosity ?? null,
      systemAdditions: data.systemAdditions,
    },
  });

  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${id}`);
  redirect("/admin/agents");
}

export async function setAgentTemplateArchived(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) throw new Error("Missing template id");

  await prisma.agentTemplate.update({ where: { id }, data: { archived } });
  revalidatePath("/admin/agents");
}
