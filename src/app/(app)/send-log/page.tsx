import { Construction, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// STUBBED for v1 — intentionally. See the note below for exactly why.
export default function SendLogPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Send Log</h1>
        <p className="text-sm text-muted-foreground">Recent messages sent through Postal.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-5 w-5 text-amber-500" />
            Not available in v1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Postal 3.3.7 exposes <span className="font-medium text-foreground">no API to list messages</span> —
            its only message endpoints look up a single message by id. The message data itself lives in{" "}
            <span className="font-medium text-foreground">separate per-server databases</span>{" "}
            (<code className="rounded bg-muted px-1 py-0.5 text-xs">postal-server-*</code>), which
            MailTide&apos;s read-only DB user is deliberately not granted access to.
          </p>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              To enable a send log later, grant the read-only user SELECT on the relevant{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">postal-server-N</code>{" "}
              message tables and wire this page to query them. Until then, view send activity in the
              Postal web UI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
