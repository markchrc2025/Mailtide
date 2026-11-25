import { test } from "node:test";
import assert from "node:assert/strict";
import { baseSubject, cleanHtml, folderRole, snippetOf, textToHtml } from "../src/lib/mail.ts";

test("folder roles follow special-use flags and common names", () => {
  assert.equal(folderRole("INBOX"), "inbox");
  assert.equal(folderRole("Sent", "\\Sent"), "sent");
  assert.equal(folderRole("Gesendet", "\\Sent"), "sent");
  assert.equal(folderRole("Junk"), "junk");
  assert.equal(folderRole("Deleted Items"), "trash");
  assert.equal(folderRole("Clients"), "other");
});

test("cleanHtml removes scripts, handlers and javascript links", () => {
  const out = cleanHtml('<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="https://a/b.png" onerror="y()">');
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes("onclick"));
  assert.ok(!out.includes("onerror"));
  assert.ok(!out.includes("javascript:"));
  assert.ok(out.includes("<p>Hi</p>"));
  assert.ok(out.includes('src="https://a/b.png"'));
});

test("cleanHtml opens links in a new tab safely", () => {
  const out = cleanHtml('<a href="https://sentire.solutions">s</a>');
  assert.ok(out.includes('target="_blank"'));
  assert.ok(out.includes("noopener"));
});

test("textToHtml escapes and links", () => {
  const out = textToHtml("a <b> & c\nhttps://x.ph\n\nnext");
  assert.ok(out.includes("&lt;b&gt;"));
  assert.ok(out.includes('<a href="https://x.ph"'));
  assert.equal((out.match(/<p>/g) || []).length, 2);
});

test("baseSubject strips reply and forward prefixes", () => {
  assert.equal(baseSubject("Re: Fwd: RE: Hello"), "Hello");
  assert.equal(baseSubject("Hello"), "Hello");
});

test("snippetOf squashes whitespace and cuts length", () => {
  assert.equal(snippetOf("a\n\n  b\tc"), "a b c");
  assert.equal(snippetOf("x".repeat(300)).length, 140);
});

test("textToHtml turns quoted history into a foldable blockquote", () => {
  const out = textToHtml("Thanks!\n\nOn Wed, 25 Nov 2026, Mark <m@x.ph> wrote:\n> hello\n> > older");
  assert.ok(out.startsWith("<p>Thanks!</p>"));
  assert.ok(out.includes('<div class="mt-quote"><p>On Wed, 25 Nov 2026, Mark &lt;m@x.ph&gt; wrote:</p><blockquote>'));
  assert.ok(out.includes("<blockquote><p>older</p></blockquote>"));
});
