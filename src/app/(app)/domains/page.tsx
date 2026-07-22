import { Info } from "lucide-react";
import { listDomains } from "@/lib/postal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusPill({ label, status }: { label: string; status: string | null }) {
  const s = (status || "").toLowerCase();
  const variant = !status
    ? "muted"
    : s === "ok"
      ? "success"
      : s === "missing" || s === "pending"
        ? "warning"
        : "destructive";
  return (
    <Badge variant={variant as never}>
      {label}: {status || "—"}
    </Badge>
  );
}

export default async function DomainsPage() {
  const result = await listDomains();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
        <p className="text-sm text-muted-foreground">
          Sending domains configured in Postal, read live. Read-only here.
        </p>
      </header>

      <Card className="border-primary/20 bg-accent/40">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            To add a new domain, use <span className="font-medium text-foreground">add-domain</span>.
            MailTide does not create domains or edit DNS.
          </p>
        </CardContent>
      </Card>

      {!result.ok ? (
        <ErrorState message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState
          title="No domains yet"
          message="Postal has no sending domains configured. Add one with add-domain, then reload."
        />
      ) : (
        <div className="space-y-3">
          {result.data.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    {d.verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                    {d.outgoing && <Badge variant="outline">Outgoing</Badge>}
                    {d.incoming && <Badge variant="outline">Incoming</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill label="SPF" status={d.spfStatus} />
                    <StatusPill label="DKIM" status={d.dkimStatus} />
                    <StatusPill label="MX" status={d.mxStatus} />
                    <StatusPill label="Return-path" status={d.returnPathStatus} />
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {d.verified ? `Verified ${formatDate(d.verifiedAt)}` : "Not yet verified"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
