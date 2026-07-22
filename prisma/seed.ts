/**
 * Idempotent seed: ensures ONE Organization and ONE OWNER user exist,
 * created from environment variables. Safe to run on every boot.
 *
 * Multi-tenant note: this seeds the single bootstrap org/owner. Additional
 * orgs and users (ADMIN/MEMBER/VIEWER) are a future feature; the schema and
 * auth layer already support them.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load .env when run standalone (e.g. `npm run seed`). In the container the
// env is already provided via compose, and there is no .env file — hence the
// try/catch.
try {
  process.loadEnvFile();
} catch {
  /* env already present in process.env */
}

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const orgName = process.env.ORG_NAME?.trim() || "MailTide";

  if (!email || !password) {
    throw new Error(
      "Seed aborted: ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment."
    );
  }

  // 1) Ensure the single bootstrap organization exists.
  //    We treat the first org as the singleton for now.
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({ data: { name: orgName } });
    console.log(`[seed] created organization "${org.name}" (${org.id})`);
  } else {
    console.log(`[seed] organization already exists (${org.id})`);
  }

  // 2) Ensure the owner user exists. Update the password hash on each run so
  //    changing ADMIN_PASSWORD in env takes effect on next boot.
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.OWNER,
        organizationId: org.id,
      },
    });
    console.log(`[seed] created OWNER user ${user.email} (${user.id})`);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: Role.OWNER, organizationId: org.id },
    });
    console.log(`[seed] updated OWNER user ${existing.email} (${existing.id})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("[seed] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
