import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit } from "@/lib/org";
import { mailcow } from "@/lib/mailcow";
import { checkDomain } from "@/lib/dnscheck";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

/** The organization's domains with a live DNS check, or one domain's check (?check=domain) for the setup window. */
export const GET = adminRoute(async ({ org }, req: Request) => {
  const one = new URL(req.url).searchParams.get("check");
  try {
    if (one) {
      const dk = await mailcow.dkim(one).catch(() => ({}) as { dkim_selector?: string; dkim_txt?: string });
      return json({ domain: one, ...(await checkDomain(one, { selector: dk.dkim_selector, txt: dk.dkim_txt })) });
    }
    const all = (await mailcow.domains()).filter((d) => org.domains.includes(d.domain_name));
    const domains = await Promise.all(
      all.map(async (d) => {
        const dk = await mailcow.dkim(d.domain_name).catch(() => ({}) as { dkim_selector?: string; dkim_txt?: string });
        return { name: d.domain_name, active: String(d.active) === "1", mailboxes: Number(d.mboxes_in_domain) || 0, ...(await checkDomain(d.domain_name, { selector: dk.dkim_selector, txt: dk.dkim_txt })) };
      }),
    );
    return json({ domains });
  } catch (e) {
    return adminFail(e);
  }
});

const Body = z.object({ domain: z.string().trim().toLowerCase().regex(/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/, "Type a domain like yourcompany.com") });

/** Adds a domain in mailcow (step 1 of Connect a domain). Sending through Postal is set up by Sentire after the records check out. */
export const POST = adminRoute(async ({ user, org }, req: Request) => {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message || "Type a domain.");
  const { domain } = p.data;
  try {
    const exists = (await mailcow.domains()).some((d) => d.domain_name === domain);
    if (!exists) {
      await mailcow.addDomain(domain, `${org.name} (added in MailTide admin)`);
      await audit(org.name, user.email, "Domains", `Domain ${domain} added; waiting for DNS records`);
    } else if (!org.domains.includes(domain)) {
      return fail("That domain is already on MailTide under another organization.", 409);
    }
    const dk = await mailcow.dkim(domain).catch(() => ({}) as { dkim_selector?: string; dkim_txt?: string });
    const c = await checkDomain(domain, { selector: dk.dkim_selector, txt: dk.dkim_txt });
    return json({ added: true, domain, checks: c.checks, ready: c.ok });
  } catch (e) {
    return adminFail(e);
  }
});
