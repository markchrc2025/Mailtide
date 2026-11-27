// Checks a domain's mail DNS records against what MailTide needs.
import { promises as dns } from "node:dns";

export type Check = { type: string; name: string; value: string; status: "found" | "missing" | "wrong"; found?: string };

const txt = async (name: string) => {
  try {
    return (await dns.resolveTxt(name)).map((r) => r.join(""));
  } catch {
    return [];
  }
};

export async function checkDomain(domain: string, dkim?: { selector?: string; txt?: string }): Promise<{ checks: Check[]; ok: boolean }> {
  const checks: Check[] = [];
  let mx: { exchange: string; priority: number }[] = [];
  try {
    mx = await dns.resolveMx(domain);
  } catch {
    /* none */
  }
  const ours = mx.some((m) => m.exchange.toLowerCase().replace(/\.$/, "") === "mx.sentire.solutions");
  checks.push({ type: "MX", name: "@", value: "10 mx.sentire.solutions", status: ours ? "found" : mx.length ? "wrong" : "missing", found: mx.map((m) => `${m.priority} ${m.exchange}`).join(", ") });

  const spf = (await txt(domain)).find((t) => t.toLowerCase().startsWith("v=spf1"));
  const spfOk = !!spf && /include:spf\.(postal\.)?sentire\.solutions|ip4:169\.58\.24\.215/.test(spf);
  checks.push({ type: "TXT (SPF)", name: "@", value: "v=spf1 include:spf.sentire.solutions ~all", status: spfOk ? "found" : spf ? "wrong" : "missing", found: spf });

  const sel = dkim?.selector || "dkim";
  const dk = (await txt(`${sel}._domainkey.${domain}`)).find((t) => t.includes("v=DKIM1") || t.includes("p="));
  checks.push({ type: "TXT (DKIM)", name: `${sel}._domainkey`, value: dkim?.txt || "[key from mailcow]", status: dk ? (dkim?.txt && !dk.replace(/\s/g, "").includes((dkim.txt.match(/p=([^;]+)/)?.[1] || "").replace(/\s/g, "").slice(0, 40)) ? "wrong" : "found") : "missing" });

  const dm = (await txt(`_dmarc.${domain}`)).find((t) => t.toUpperCase().startsWith("V=DMARC1"));
  checks.push({ type: "TXT (DMARC)", name: "_dmarc", value: "v=DMARC1; p=none", status: dm ? "found" : "missing", found: dm });

  let auto = false;
  try {
    auto = (await dns.resolveCname(`autodiscover.${domain}`)).some((c) => c.toLowerCase().replace(/\.$/, "") === "mx.sentire.solutions");
  } catch {
    /* optional */
  }
  checks.push({ type: "CNAME", name: "autodiscover", value: "mx.sentire.solutions", status: auto ? "found" : "missing" });

  const ok = checks.slice(0, 4).every((c) => c.status === "found");
  return { checks, ok };
}
