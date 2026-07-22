"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * The friction-killer: a copy-ready env block for an app.
 *
 *   POSTAL_API_KEY=<live key>
 *   POSTAL_API_URL=<base>/api/v1/send/message
 *   MAIL_FROM=<local>@<verified domain the operator picks>
 *
 * The key is read live from Postal on the server and passed in here; it is
 * never persisted by MailTide.
 */
export function EnvBlock({
  apiKey,
  sendUrl,
  domains,
}: {
  apiKey: string;
  sendUrl: string;
  domains: string[];
}) {
  const [localPart, setLocalPart] = React.useState("no-reply");
  const [domain, setDomain] = React.useState(domains[0] ?? "");
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const mailFrom = domain ? `${localPart || "no-reply"}@${domain}` : `${localPart || "no-reply"}@your-verified-domain`;

  const block = [
    `POSTAL_API_KEY=${apiKey}`,
    `POSTAL_API_URL=${sendUrl}`,
    `MAIL_FROM=${mailFrom}`,
  ].join("\n");

  const displayBlock = revealed
    ? block
    : [
        `POSTAL_API_KEY=${"•".repeat(Math.max(apiKey.length, 8))}`,
        `POSTAL_API_URL=${sendUrl}`,
        `MAIL_FROM=${mailFrom}`,
      ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked (e.g. non-HTTPS). Fall back to selection.
      setRevealed(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="localpart">MAIL_FROM local part</Label>
          <Input
            id="localpart"
            value={localPart}
            onChange={(e) => setLocalPart(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))}
            placeholder="no-reply"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="domain">Verified sending domain</Label>
          {domains.length > 0 ? (
            <select
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <Input value="" placeholder="no verified domain on this server" disabled />
          )}
        </div>
      </div>

      <div className="relative">
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-4 pr-24 font-mono text-xs leading-relaxed text-foreground">
          <code>{displayBlock}</code>
        </pre>
        <div className="absolute right-2 top-2 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={revealed ? "Hide key" : "Reveal key"}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {domains.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No verified sending domain is attached to this credential&apos;s Postal server, so
          MAIL_FROM shows a placeholder. Verify a domain in Postal, then reload.
        </p>
      )}
    </div>
  );
}
