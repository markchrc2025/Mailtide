import { authed, json } from "@/lib/http";
import { config, isAdmin } from "@/lib/config";

export const GET = authed(async (user) => {
  const domain = user.email.split("@")[1]?.toLowerCase() || "";
  return json({ email: user.email, name: user.name ?? null, admin: isAdmin(user.email), org: config.orgNames[domain] || domain });
});
