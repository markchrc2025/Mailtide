import { authed, json } from "@/lib/http";
import { config } from "@/lib/config";
import { isAdminRole, roleOf } from "@/lib/org";

export const GET = authed(async (user) => {
  const domain = user.email.split("@")[1]?.toLowerCase() || "";
  const role = await roleOf(user.email);
  return json({ email: user.email, name: user.name ?? null, role, admin: isAdminRole(role), org: config.orgNames[domain] || domain });
});
