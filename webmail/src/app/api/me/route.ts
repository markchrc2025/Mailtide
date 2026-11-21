import { authed, json } from "@/lib/http";

export const GET = authed(async (user) => json({ email: user.email, name: user.name ?? null }));
