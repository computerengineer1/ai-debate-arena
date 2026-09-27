/**
 * Auth — NextAuth v5 (Auth.js), JWT sessions (no DB required).
 * Providers activate automatically when their env keys exist, so the
 * app runs fine before you configure OAuth:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 *   DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
 * Secrets live in Vercel env — never in the repo.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import type { Provider } from "next-auth/providers";

const providers: Provider[] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(GitHub({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }));
}
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(Discord({ clientId: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? token.sub ?? "";
      }
      return session;
    },
  },
});

/** Resolve the caller identity: member (email) or guest token. */
export async function resolveIdentity(req: Request): Promise<{ id: string; guest: boolean } | null> {
  const session = await auth();
  if (session?.user?.email) return { id: session.user.email.toLowerCase(), guest: false };
  const guestToken = req.headers.get("x-guest-token");
  if (guestToken && /^[a-f0-9-]{36}$/i.test(guestToken)) return { id: `guest:${guestToken}`, guest: true };
  return null;
}
