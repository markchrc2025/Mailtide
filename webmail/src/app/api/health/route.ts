import tls from "node:tls";
import { BUILD, config } from "@/lib/config";

export const dynamic = "force-dynamic";

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port, servername: host, timeout: 5000 }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
  });
}

export async function GET() {
  const imap = await probe(config.imapHost, config.imapPort);
  return Response.json({ ok: true, build: BUILD, imap }, { status: imap ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
