import { authed } from "@/lib/http";
import { exportVcf, listContacts } from "@/lib/dav";
import { davFail } from "@/lib/davhttp";

export const dynamic = "force-dynamic";

export const GET = authed(async (user) => {
  try {
    const body = exportVcf(await listContacts(user));
    return new Response(body, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="mailtide-contacts.vcf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return davFail(e);
  }
});
