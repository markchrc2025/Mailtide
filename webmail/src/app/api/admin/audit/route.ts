import { json } from "@/lib/http";
import { adminRoute } from "@/lib/org";
import { hasDb, q } from "@/lib/db";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async ({ org }, req: Request) => {
  if (!hasDb()) return json({ entries: [] });
  const u = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(u.searchParams.get("days") || 30)));
  const area = u.searchParams.get("area") || "";
  const text = (u.searchParams.get("q") || "").slice(0, 100);
  try {
    const entries = await q(
      `select at, actor, area, action from audit where org = $1 and at > now() - ($2 || ' days')::interval
       and ($3 = '' or area = $3) and ($4 = '' or action ilike '%' || $4 || '%' or actor ilike '%' || $4 || '%')
       order by at desc limit 500`,
      [org.name, String(days), area, text],
    );
    if (u.searchParams.get("format") === "csv") {
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      const rows = (entries as { at: Date; actor: string; area: string; action: string }[]).map((e) => [new Date(e.at).toISOString(), e.actor, e.area, e.action].map(esc).join(","));
      return new Response(["When,Who,Area,What happened", ...rows].join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mailtide-audit-log.csv"' },
      });
    }
    return json({ entries });
  } catch (e) {
    return adminFail(e);
  }
});
