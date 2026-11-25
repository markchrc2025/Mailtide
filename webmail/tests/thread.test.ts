import { test } from "node:test";
import assert from "node:assert/strict";
import { hasQuote, idsOf, linked, normId, orderThread } from "../src/lib/thread.ts";

test("normId wraps and lower-cases Message-IDs", () => {
  assert.equal(normId("<ABC@x.ph>"), "<abc@x.ph>");
  assert.equal(normId("abc@x.ph"), "<abc@x.ph>");
  assert.equal(normId(""), null);
});

test("idsOf collects own id, in-reply-to and references once", () => {
  assert.deepEqual(idsOf({ messageId: "<b@x>", inReplyTo: "<a@x>", references: ["<a@x>"] }).sort(), ["<a@x>", "<b@x>"]);
});

test("linked finds messages in the same chain", () => {
  const a = { messageId: "<a@x>", references: [] };
  const b = { messageId: "<b@x>", inReplyTo: "<a@x>", references: ["<a@x>"] };
  const c = { messageId: "<c@x>", references: [] };
  assert.ok(linked(a, b));
  assert.ok(!linked(a, c));
});

test("orderThread keeps one copy per Message-ID (open folder wins) and puts newest first", () => {
  const msgs = [
    { uid: 1, folder: "INBOX", messageId: "<a@x>", references: [], date: "2026-11-25T15:46:00Z" },
    { uid: 7, folder: "Sent", messageId: "<b@x>", references: ["<a@x>"], date: "2026-11-25T15:47:00Z" },
    { uid: 9, folder: "Archive", messageId: "<a@x>", references: [], date: "2026-11-25T15:46:00Z" },
  ];
  const out = orderThread(msgs, "Archive");
  assert.deepEqual(out.map((m) => `${m.folder}:${m.uid}`), ["Sent:7", "Archive:9"]);
});

test("hasQuote spots quoted history", () => {
  assert.ok(hasQuote('<div class="mt-quote"><blockquote>x</blockquote></div>'));
  assert.ok(hasQuote('<div class="gmail_quote">x</div>'));
  assert.ok(hasQuote('<div id="divRplyFwdMsg">x</div>'));
  assert.ok(!hasQuote("<p>hi</p>"));
});
