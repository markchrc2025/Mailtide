import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Shown when Postal's DB is unreachable or a query fails — never a blank crash. */
export function ErrorState({ title, message }: { title?: string; message: string }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex items-start gap-3 pt-6">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-destructive">{title ?? "Couldn't load from Postal"}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Shown when a query succeeds but returns nothing. */
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
