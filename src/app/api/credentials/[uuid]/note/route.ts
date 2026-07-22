import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, AuthError } from "@/lib/authz";

export const dynamic = "force-dynamic";

const schema = z.object({ note: z.string().max(200).nullable().optional() });

// Saving a note is a MUTATING action, so it is wrapped by an RBAC check
// (ADMIN+), even though today only the seeded OWNER exists.
export async function PUT(req: Request, { params }: { params: { uuid: string } }) {
  try {
    const ctx = await requireRole("ADMIN");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }

    const note = parsed.data.note?.trim() || null;

    // TODO(multi-tenant): once Postal resources are mapped per-org, verify this
    // credential uuid actually belongs to ctx.organization before writing.
    await prisma.credentialNote.upsert({
      where: {
        organizationId_postalCredentialUuid: {
          organizationId: ctx.organization.id,
          postalCredentialUuid: params.uuid,
        },
      },
      create: {
        organizationId: ctx.organization.id,
        postalCredentialUuid: params.uuid,
        note,
      },
      update: { note },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
