import { test } from "node:test";
import assert from "node:assert/strict";
import ICAL from "ical.js";
import { buildCard, buildEvent, exportVcf, parseVcf } from "../src/lib/dav.ts";
import { dateGroup } from "../src/lib/client.ts";

test("buildEvent writes a valid timed event with attendees, reminder and repeat", () => {
  const text = buildEvent(
    { calendar: "/c/", title: "Plan, review; and sign", start: "2026-11-27T05:00:00.000Z", end: "2026-11-27T05:30:00.000Z", allDay: false, required: ["a@x.com"], optional: ["b@x.com"], reminderMinutes: 15, repeat: "weekly", meetingLink: "https://meet.example.com/abc", busy: false, isPrivate: true },
    { email: "me@sentire.solutions", name: "Me" },
    "uid-1@test",
    "REQUEST",
  );
  const vcal = new ICAL.Component(ICAL.parse(text));
  assert.equal(vcal.getFirstPropertyValue("method"), "REQUEST");
  const ev = new ICAL.Event(vcal.getFirstSubcomponent("vevent")!);
  assert.equal(ev.summary, "Plan, review; and sign");
  assert.equal(ev.startDate.toJSDate().toISOString(), "2026-11-27T05:00:00.000Z");
  assert.equal(ev.isRecurring(), true);
  const c = ev.component;
  assert.equal(c.getAllProperties("attendee").length, 2);
  assert.equal(c.getFirstPropertyValue("transp"), "TRANSPARENT");
  assert.equal(c.getFirstPropertyValue("class"), "PRIVATE");
  assert.match(text, /TRIGGER:-PT15M/);
  assert.match(text.replace(/\r\n /g, ""), /SCHEDULE-AGENT=CLIENT/);
  assert.ok(text.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "lines are folded");
});

test("buildEvent writes all-day events as dates", () => {
  const text = buildEvent({ calendar: "/c/", title: "Holiday", start: "2026-12-25", end: "2026-12-26", allDay: true }, { email: "me@x.com" }, "u2");
  assert.match(text, /DTSTART;VALUE=DATE:20261225/);
  assert.doesNotMatch(text, /ORGANIZER/);
});

test("vCards round-trip through build, export and import", () => {
  const card = buildCard({ first: "Christian", last: "Canlubo", emails: [{ type: "work", value: "c@mcrctas.com" }], phones: [{ type: "cell", value: "+63 900 000 0000" }], company: "MCRC, Tax", title: "", notes: "Line 1\nLine 2", categories: ["Clients"], favorite: true }, "u3");
  const [back] = parseVcf(card + card.replace("u3", "u4"));
  assert.equal(back.first, "Christian");
  assert.equal(back.last, "Canlubo");
  assert.equal(back.company, "MCRC, Tax");
  assert.equal(back.notes, "Line 1\nLine 2");
  assert.deepEqual(back.categories, ["Clients"]);
  assert.equal(back.favorite, true);
  assert.equal(parseVcf(card + card).length, 2);
  assert.equal(exportVcf([]), "");
});

test("dateGroup buckets like Outlook", () => {
  const now = new Date(2026, 10, 28, 10, 0); // Sat 28 Nov 2026
  assert.equal(dateGroup(new Date(2026, 10, 28, 8).toISOString(), now), "Today");
  assert.equal(dateGroup(new Date(2026, 10, 27, 8).toISOString(), now), "Yesterday");
  assert.equal(dateGroup(new Date(2026, 10, 24, 8).toISOString(), now), "This week");
  assert.equal(dateGroup(new Date(2026, 10, 18, 8).toISOString(), now), "Last week");
  assert.equal(dateGroup(new Date(2026, 10, 3, 8).toISOString(), now), "Earlier this month");
  assert.equal(dateGroup(new Date(2026, 5, 3, 8).toISOString(), now), "June");
  assert.equal(dateGroup(new Date(2025, 5, 3, 8).toISOString(), now), "Older");
});
