import { type PageHeaderBaseProps } from "@/components/connect/page-header-base";
import { cn } from "@/lib/cn";

/**
 * Uniform admin page title — Portfolio bento canon.
 *
 * Renders the page H1 bicolore (`titleLead` blanc + `titleAccent` vert #A7FB90),
 * an optional uppercase kicker (`contextLabel`/`eyebrow`), an accent-aware
 * description, then a hairline separator with the filters/actions toolbar.
 *
 * Keeps the {@link PageHeaderBaseProps} contract verbatim and pins the
 * `admin-page-header` BEM root so the proof-center root contract test (which
 * asserts the admin namespace is *absent* on the user hub) still holds.
 *
 * API canon: `titleLead` + `titleAccent` + `contextLabel`.
 * API legacy: `title` (+ `accent`, `eyebrow`, `description`).
 */
export function AdminPageHeader({
  eyebrow,
  title,
  titleLead,
  titleAccent,
  accent,
  contextLabel,
  description,
  lead,
  media,
  actions,
  filters,
  beforeRule,
  titleRowEnd,
  children,
  className,
  align = "start",
}: PageHeaderBaseProps) {
  const centered = align === "center";
  const kicker = contextLabel ?? eyebrow;
  const hasCanonTitle = titleLead != null || titleAccent != null;

  return (
    <header
      className={cn(
        "admin-page-header mb-6 flex flex-col gap-4",
        centered && "admin-page-header--center items-center text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-wrap items-end gap-4",
          titleRowEnd ? "justify-between" : "justify-start",
          centered && "justify-center",
        )}
      >
        <div className={cn("flex min-w-0 items-start gap-4", centered && "flex-col items-center")}>
          {media ? <div className="shrink-0">{media}</div> : null}
          <div className={cn("flex min-w-0 flex-col gap-2", centered && "items-center")}>
            {lead ? (
              <div className="text-[12px] text-zinc-500">{lead}</div>
            ) : null}
            {kicker ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {kicker}
              </p>
            ) : null}
            <h1 className="text-[24px] font-semibold leading-none tracking-tight text-white">
              {hasCanonTitle ? (
                <>
                  {titleLead}
                  {titleAccent ? (
                    <>
                      {titleLead ? " " : null}
                      <span className="text-[#A7FB90]">{titleAccent}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {title}
                  {accent ? (
                    <>
                      {" "}
                      <span className="text-[#A7FB90]">{accent}</span>
                    </>
                  ) : null}
                </>
              )}
            </h1>
            {description ? (
              <div
                className={cn(
                  "max-w-prose text-[13px] leading-relaxed text-zinc-400",
                  centered && "mx-auto",
                )}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {titleRowEnd ? <div className="shrink-0">{titleRowEnd}</div> : null}
      </div>
      {beforeRule}
      <div className="h-px w-full bg-white/10" aria-hidden="true" />
      {filters || actions ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3",
            centered ? "justify-center" : "justify-between",
          )}
        >
          {filters ? (
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </header>
  );
}
