import { json } from "@/lib/http";
import { adminRoute } from "@/lib/org";
import { hasMailcow, mailcow } from "@/lib/mailcow";
import { hasDb, q } from "@/lib/db";
import { checkDomain } from "@/lib/dnscheck";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async ({ org, role }) => {
  try {
    const connected = hasMailcow();
    let domains: { name: string; ok: boolean; mailboxes: number }[] = [];
    let mailboxes = 0;
    let storage = 0;
    if (connected) {
      const all = (await mailcow.domains()).filter((d) => org.domains.includes(d.domain_name));
      domains = await Promise.all(
        all.map(async (d) => {
          const dk = await mailcow.dkim(d.domain_name).catch(() => ({}) as { dkim_selector?: string; dkim_txt?: string });
          const c = await checkDomain(d.domain_name, { selector: dk.dkim_selector, txt: dk.dkim_txt });
          return { name: d.domain_name, ok: c.ok, mailboxes: Number(d.mboxes_in_domain) || 0 };
        }),
      );
      mailboxes = domains.reduce((s, d) => s + d.mailboxes, 0);
      storage = all.reduce((s, d) => s + Number(d.quota_used_in_domain || 0), 0);
    }
    const shared = hasDb() ? Number((await q<{ n: string }>("select count(*) n from shared_mailboxes where org = $1", [org.name]))[0]?.n || 0) : 0;
    const activity = hasDb() ? await q("select at, actor, area, action from audit where org = $1 order by at desc limit 5", [org.name]) : [];
    return json({ org: org.name, role, connected, db: hasDb(), domains, mailboxes, storage, shared, activity });
  } catch (e) {
    return adminFail(e);
  }
});
