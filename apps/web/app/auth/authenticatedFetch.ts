import { getSupabaseBrowserClient } from "./supabaseBrowserClient";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Configure local Supabase Auth before signing in");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("Sign in with the super_admin account to continue");
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
