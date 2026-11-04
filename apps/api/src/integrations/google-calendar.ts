/**
 * Thin Google Calendar v3 client over `fetch`.
 *
 * Deliberately not the `googleapis` SDK: we need six endpoints, and the SDK
 * pulls a large dependency tree plus its own auth caching that would fight the
 * token storage in `calendar_connections`.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * `calendar.events` covers reading and writing events; `calendar.readonly` is
 * what lets the user pick which of their calendars to sync. `email` is only so
 * settings can show which account is linked.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Thrown for any non-2xx provider response, carrying the HTTP status. */
export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "GoogleApiError";
  }

  /** Google answers 410 GONE when a sync token is too old to resume from. */
  get isSyncTokenExpired(): boolean {
    return this.status === 410;
  }

  /** A revoked or expired grant — the user must re-authorise. */
  get isAuthRevoked(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 403 || this.status === 429;
  }
}

/**
 * Reads OAuth config from the environment.
 *
 * Returns `null` rather than throwing so the settings screen can render an
 * honest "not configured on this server" state instead of erroring.
 */
export function googleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const base = (process.env.API_PUBLIC_URL ?? "http://localhost:3001").replace(
    /\/$/,
    ""
  );
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
      `${base}/oauth/google/calendar/callback`,
  };
}

export function buildAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // `offline` is what yields a refresh token; without it the link dies in an
    // hour. `consent` forces Google to re-issue one even on a repeat grant,
    // which it otherwise omits.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function readError(response: Response): Promise<GoogleApiError> {
  let body: unknown;
  let message = response.statusText;
  try {
    body = await response.json();
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") {
      message = err;
    } else if (err && typeof err === "object") {
      message = String((err as { message?: unknown }).message ?? message);
    }
  } catch {
    /* non-JSON error body; the status is what matters */
  }
  return new GoogleApiError(response.status, message, body);
}

export interface GoogleTokens {
  accessToken: string;
  /** Absent on refresh responses — keep the stored one in that case. */
  refreshToken: string | null;
  expiresAt: Date;
  scope: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

function tokensFromResponse(payload: TokenResponse): GoogleTokens {
  // Shave 30s off so a token is never handed out with a sliver of life left.
  const lifetime = Math.max(0, (payload.expires_in ?? 3600) - 30);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: new Date(Date.now() + lifetime * 1000),
    scope: payload.scope ?? null,
  };
}

export async function exchangeCode(
  config: GoogleOAuthConfig,
  code: string
): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw await readError(response);
  return tokensFromResponse((await response.json()) as TokenResponse);
}

export async function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string
): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw await readError(response);
  return tokensFromResponse((await response.json()) as TokenResponse);
}

/** Best-effort: a revoke failure must not block disconnecting locally. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchAccountEmail(
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

async function callApi<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  timeZone: string | null;
}

export async function listCalendars(
  accessToken: string
): Promise<GoogleCalendarSummary[]> {
  const payload = await callApi<{
    items?: {
      id: string;
      summary?: string;
      primary?: boolean;
      accessRole?: string;
      timeZone?: string;
    }[];
  }>(accessToken, "/users/me/calendarList?minAccessRole=reader");

  return (payload.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    primary: item.primary ?? false,
    accessRole: item.accessRole ?? "reader",
    timeZone: item.timeZone ?? null,
  }));
}

/** A Google event date/time — exactly one of `date` (all-day) or `dateTime`. */
export interface GoogleEventTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  recurrence?: string[];
  etag?: string;
  updated?: string;
  created?: string;
  /** Set by us on push, so a pull can recognise our own writes. */
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

export interface ListEventsResult {
  events: GoogleEvent[];
  nextPageToken: string | null;
  nextSyncToken: string | null;
}

export async function listEvents(
  accessToken: string,
  options: {
    calendarId: string;
    syncToken?: string | null;
    timeMin?: Date;
    timeMax?: Date;
    pageToken?: string | null;
    maxResults?: number;
  }
): Promise<ListEventsResult> {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 250),
    // Deleted events must come through, otherwise an incremental pull can never
    // learn that something was removed at the provider.
    showDeleted: "true",
    singleEvents: "false",
  });

  if (options.syncToken) {
    // Google rejects a sync token combined with any filter; the token already
    // encodes the window from the previous full sync.
    params.set("syncToken", options.syncToken);
  } else {
    if (options.timeMin) params.set("timeMin", options.timeMin.toISOString());
    if (options.timeMax) params.set("timeMax", options.timeMax.toISOString());
  }
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const payload = await callApi<{
    items?: GoogleEvent[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }>(
    accessToken,
    `/calendars/${encodeURIComponent(options.calendarId)}/events?${params.toString()}`
  );

  return {
    events: payload.items ?? [],
    nextPageToken: payload.nextPageToken ?? null,
    nextSyncToken: payload.nextSyncToken ?? null,
  };
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: Partial<GoogleEvent>
): Promise<GoogleEvent> {
  return callApi<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(event) }
  );
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleEvent>
): Promise<GoogleEvent> {
  return callApi<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(event) }
  );
}

/**
 * Deletes an event, treating "already gone" as success — a 404/410 means the
 * desired end state already holds, and failing would strand the tombstone.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    await callApi<void>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  } catch (err) {
    if (
      err instanceof GoogleApiError &&
      (err.status === 404 || err.status === 410)
    ) {
      return;
    }
    throw err;
  }
}
