export type AdminTokenResult =
  | { ok: true; token: string }
  | { ok: false; message: string };

const ADMIN_LOGIN_URL = 'https://gyaftckpvcldivyfzyiq.supabase.co/functions/v1/admin-login';

export async function requestAdminToken(password: string): Promise<AdminTokenResult> {
  let response: Response;
  try {
    response = await fetch(ADMIN_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch (err) {
    console.error('[admin-login] request failed before a response was received', err);
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }

  const body = await response.json().catch(() => null);

  if (response.status === 429) {
    const minutes = typeof body?.retryAfterMinutes === 'number' ? body.retryAfterMinutes : 15;
    return { ok: false, message: `Too many failed attempts. Try again in ${minutes} minute(s).` };
  }
  if (response.status === 401) {
    return { ok: false, message: 'Incorrect password.' };
  }
  if (!response.ok) {
    const serverMessage = typeof body?.error === 'string' ? body.error : 'no error message';
    console.error(`[admin-login] HTTP ${response.status}: ${serverMessage}`);
    return { ok: false, message: `Admin login failed (HTTP ${response.status}): ${serverMessage}` };
  }
  if (typeof body?.customToken !== 'string' || body.customToken.length === 0) {
    console.error('[admin-login] success response did not include customToken');
    return { ok: false, message: 'Admin login failed: the server did not return a login token.' };
  }
  return { ok: true, token: body.customToken };
}
