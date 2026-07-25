import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export function AuthFormShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {title}
          </CardTitle>
          {description ? (
            <p className="text-sm text-muted">{description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
