import { authed, fail, json } from "@/lib/http";
import { parseVcf, saveContact } from "@/lib/dav";
import { davFail } from "@/lib/davhttp";

/** Imports a .vcf file (one or many cards), such as an export from Outlook or a phone. */
export const POST = authed(async (user, req: Request) => {
  const text = await req.text();
  if (text.length > 5_000_000) return fail("The file is too large (5 MB at most).");
  const cards = parseVcf(text);
  if (!cards.length) return fail("No contacts were found in that file. Use a .vcf (vCard) file.");
  if (cards.length > 2000) return fail("Import up to 2,000 contacts at a time.");
  let saved = 0;
  try {
    for (const c of cards) {
      await saveContact(user, c);
      saved++;
    }
    return json({ ok: true, saved });
  } catch (e) {
    if (saved) return json({ ok: true, saved, partial: true });
    return davFail(e);
  }
});
