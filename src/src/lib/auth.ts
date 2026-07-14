import { cookies } from "next/headers";

const SESSION_COOKIE = "cl_session";
const USER_ID = "user_authenticated";
const ORG_ID = "org_default";

function verifySession(): { userId: string; orgId: string } | null {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(SESSION_COOKIE);
    if (!session?.value) return null;
    const expected = process.env.ACCESS_CODE_HASH;
    if (!expected) return null;
    if (session.value !== expected) return null;
    return { userId: USER_ID, orgId: ORG_ID };
  } catch {
    return null;
  }
}

export async function requireAuth(req?: Request) {
  const session = verifySession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function getSession() {
  return verifySession();
}
