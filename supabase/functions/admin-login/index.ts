const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const TOKEN_LIFETIME_SECONDS = 3600;
const GOOGLE_TOKEN_AUDIENCE =
  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function clientKey(req: Request): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const digest = await sha256(`admin-login:${ip}`);
  return base64UrlEncode(digest);
}

async function createFirebaseCustomToken(serviceAccount: {
  client_email: string;
  private_key: string;
}, uid: string): Promise<string> {
  const pem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const keyBytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: GOOGLE_TOKEN_AUDIENCE,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
    uid,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const adminPassword = Deno.env.get("ADMIN_PANEL_PASSWORD");
    const adminUid = Deno.env.get("FIREBASE_ADMIN_UID");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!adminPassword || !adminUid || !serviceAccountJson || !supabaseUrl || !serviceRoleKey) {
      return json({ error: "Admin login is not configured" }, 500);
    }

    const { password } = await req.json().catch(() => ({ password: undefined }));
    if (typeof password !== "string" || password.length === 0 || password.length > 256) {
      return json({ error: "Password is required" }, 400);
    }

    const restHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };
    const key = await clientKey(req);
    const rowUrl = `${supabaseUrl}/rest/v1/admin_login_attempts?client_key=eq.${key}&select=*`;

    const rowRes = await fetch(rowUrl, { headers: restHeaders });
    if (!rowRes.ok) return json({ error: "Login is temporarily unavailable" }, 500);
    const rows = (await rowRes.json()) as Array<{
      failed_count: number;
      locked_until: string | null;
    }>;
    const row = rows[0];

    if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
      return json({ error: "Too many failed attempts", retryAfterMinutes: minutes }, 429);
    }

    const passwordMatches = constantTimeEqual(
      await sha256(password),
      await sha256(adminPassword),
    );

    if (!passwordMatches) {
      const failures = (row?.failed_count ?? 0) + 1;
      const lockedUntil = failures >= MAX_FAILURES
        ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
        : null;
      await fetch(`${supabaseUrl}/rest/v1/admin_login_attempts?on_conflict=client_key`, {
        method: "POST",
        headers: { ...restHeaders, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          client_key: key,
          failed_count: lockedUntil ? 0 : failures,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        }),
      });
      return json({ error: "Incorrect password" }, 401);
    }

    await fetch(rowUrl.replace("&select=*", ""), { method: "DELETE", headers: restHeaders });

    const serviceAccount = JSON.parse(serviceAccountJson);
    const token = await createFirebaseCustomToken(serviceAccount, adminUid);
    return json({ success: true, customToken: token });
  } catch (err) {
    console.error("admin-login failed", err);
    return json({ error: "Login is temporarily unavailable" }, 500);
  }
});
