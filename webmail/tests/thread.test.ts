import { test } from "node:test";
import assert from "node:assert/strict";
import { hasQuote, idsOf, linked, normId, orderThread , groupRows } from "../src/lib/thread.ts";

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

test("groupRows folds Outlook replies that only share a topic", () => {
  const base = { seen: true, flagged: false, attachments: false };
  const rows = [
    { ...base, uid: 9, subject: "Re: Thread Test 2", date: "2026-11-26T10:04:00Z", messageId: "<c@x>", inReplyTo: "<sent2@me>", seen: false },
    { ...base, uid: 8, subject: "RE: Thread Test 2", date: "2026-11-26T09:58:00Z", messageId: "<b@x>", inReplyTo: "<sent1@me>" },
    { ...base, uid: 7, subject: "Trial from outlook", date: "2026-11-25T09:00:00Z", messageId: "<a@x>" },
    { ...base, uid: 6, subject: "Invoice", date: "2026-11-25T08:00:00Z", messageId: "<i1@x>" },
    { ...base, uid: 5, subject: "Invoice", date: "2026-11-25T07:00:00Z", messageId: "<i2@y>" },
  ];
  const g = groupRows(rows);
  assert.equal(g.length, 4);
  assert.deepEqual(g[0].uids, [9, 8]);
  assert.equal(g[0].count, 2);
  assert.equal(g[0].seen, false);
  assert.equal(g.filter((r) => r.subject === "Invoice").length, 2, "same topic without a reply stays apart");
});

test("groupRows joins by In-Reply-To even when the subject changed", () => {
  const base = { seen: true, flagged: false, attachments: false };
  const g = groupRows([
    { ...base, uid: 2, subject: "New title", date: "2026-11-26T10:00:00Z", messageId: "<2@x>", inReplyTo: "<1@x>" },
    { ...base, uid: 1, subject: "Old title", date: "2026-11-26T09:00:00Z", messageId: "<1@x>" },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].subject, "New title");
});
