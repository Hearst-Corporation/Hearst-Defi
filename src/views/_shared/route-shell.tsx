import { PageHeader, PageLayout } from "@/views/_shared/layout";

export function RouteShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <PageLayout>
      <PageHeader title={title} description={description} />
      {children}
    </PageLayout>
  );
}
