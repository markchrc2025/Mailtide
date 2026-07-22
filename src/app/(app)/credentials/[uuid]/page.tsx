import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getApiCredentialWithKey } from "@/lib/postal";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postalSendMessageUrl } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/states";
import { EnvBlock } from "@/components/env-block";
import { NoteEditor } from "@/components/note-editor";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CredentialDetailPage({ params }: { params: { uuid: string } }) {
  const ctx = await getAuthContext();
  const result = await getApiCredentialWithKey(params.uuid);

  const note =
    ctx && result.ok && result.data
      ? (
          await prisma.credentialNote.findUnique({
            where: {
              organizationId_postalCredentialUuid: {
                organizationId: ctx.organization.id,
                postalCredentialUuid: params.uuid,
              },
            },
          })
        )?.note ?? ""
      : "";

  return (
    <div className="space-y-6">
      <Link
        href="/credentials"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to API Keys
      </Link>

      {!result.ok ? (
        <ErrorState message={result.error} />
      ) : !result.data ? (
        <EmptyState
          title="Credential not found"
          message="This API credential no longer exists in Postal, or its uuid changed."
        />
      ) : (
        <>
          <header className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {result.data.name || "Unnamed credential"}
              </h1>
              <Badge variant="outline">API</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(result.data.createdAt)}
              {result.data.lastUsedAt ? ` · last used ${formatDate(result.data.lastUsedAt)}` : ""}
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Env block</CardTitle>
              <CardDescription>
                Paste into your app. The key is read live from Postal and never stored by MailTide.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnvBlock
                apiKey={result.data.key}
                sendUrl={postalSendMessageUrl()}
                domains={result.data.domains}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <NoteEditor uuid={params.uuid} initialNote={note} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
