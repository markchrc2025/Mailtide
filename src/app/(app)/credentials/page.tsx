import Link from "next/link";
import { Info, KeyRound, ChevronRight } from "lucide-react";
import { listApiCredentials } from "@/lib/postal";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  const ctx = await getAuthContext();
  const result = await listApiCredentials();

  // Per-credential notes live in MailTide's own DB, scoped to the org.
  const notes = ctx
    ? await prisma.credentialNote.findMany({ where: { organizationId: ctx.organization.id } })
    : [];
  const noteByUuid = new Map(notes.map((n) => [n.postalCredentialUuid, n.note ?? ""]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Postal API credentials, read live. Open one for its value and a copy-ready env block.
        </p>
      </header>

      <Card className="border-primary/20 bg-accent/40">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            To mint a new key, create an <span className="font-medium text-foreground">API</span>{" "}
            credential in Postal, then reload here. MailTide reads keys live and never stores them.
          </p>
        </CardContent>
      </Card>

      {!result.ok ? (
        <ErrorState message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState
          title="No API credentials yet"
          message="Create an API-type credential on a server in Postal, then reload this page."
        />
      ) : (
        <div className="space-y-3">
          {result.data.map((c) => {
            const note = c.uuid ? noteByUuid.get(c.uuid) : "";
            return (
              <Link key={c.id} href={`/credentials/${c.uuid}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-accent/30">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name || "Unnamed credential"}</span>
                          {note ? <Badge variant="muted">{note}</Badge> : null}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          ••••••••••••••••{c.keyHint || "????"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.domains.length > 0 ? (
                            c.domains.slice(0, 3).map((d) => (
                              <Badge key={d} variant="outline">
                                {d}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="muted">no verified domain</Badge>
                          )}
                          {c.domains.length > 3 && (
                            <Badge variant="muted">+{c.domains.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(c.createdAt)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
