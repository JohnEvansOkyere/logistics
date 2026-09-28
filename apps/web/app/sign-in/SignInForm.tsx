"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getSupabaseBrowserClient } from "../auth/supabaseBrowserClient";
import styles from "./signIn.module.css";

type AuthMode = "bootstrap" | "signin";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";

async function responseError(response: Response): Promise<Error | null> {
  if (response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : body?.message;
  return new Error(message ?? "Authentication could not be completed");
}

export function SignInForm() {
  const router = useRouter();
  const [bootstrapAvailable, setBootstrapAvailable] = useState<boolean | null>(
    null,
  );
  const [mode, setMode] = useState<AuthMode>("bootstrap");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl}/v1/auth/bootstrap-status`)
      .then(async (response) => {
        const failure = await responseError(response);
        if (failure) {
          throw failure;
        }
        return (await response.json()) as { bootstrapAvailable: boolean };
      })
      .then((status) => {
        if (active) {
          setBootstrapAvailable(status.bootstrapAvailable);
          setMode(status.bootstrapAvailable ? "bootstrap" : "signin");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The local Auth service is unavailable",
          );
          setBootstrapAvailable(false);
          setMode("signin");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error(
          "Set the local Supabase URL and publishable key in .env",
        );
      }

      const result =
        mode === "bootstrap"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        throw result.error;
      }

      const accessToken = result.data.session?.access_token;
      if (!accessToken) {
        setNotice("Check your email to confirm the account, then sign in.");
        return;
      }

      const endpoint = bootstrapAvailable
        ? `${apiBaseUrl}/v1/auth/bootstrap-super-admin`
        : `${apiBaseUrl}/v1/auth/session`;
      const response = await fetch(endpoint, {
        method: bootstrapAvailable ? "POST" : "GET",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const failure = await responseError(response);
      if (failure) {
        if (response.status === 409) {
          setBootstrapAvailable(false);
          setMode("signin");
        }
        throw failure;
      }

      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  if (bootstrapAvailable === null && !error) {
    return (
      <div className={styles.signInCard} role="status" aria-live="polite">
        Checking local setup…
      </div>
    );
  }

  return (
    <section className={styles.signInCard}>
      <p className={styles.eyebrow}>LOCAL STAFF ACCESS</p>
      <h1>{mode === "bootstrap" ? "Create super admin" : "Sign in"}</h1>
      <p className={styles.description}>
        {mode === "bootstrap"
          ? "The first local account becomes the super admin. Bootstrap closes after that account is assigned."
          : "Sign in with your invited staff account to continue to the workspace."}
      </p>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor="auth-email">
          Email
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label htmlFor="auth-password">
          Password
          <input
            autoComplete={
              mode === "bootstrap" ? "new-password" : "current-password"
            }
            id="auth-password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        <button disabled={loading} type="submit">
          {loading
            ? "Working…"
            : mode === "bootstrap"
              ? "Create super admin"
              : "Sign in"}
        </button>
      </form>

      {bootstrapAvailable && (
        <button
          className={styles.modeButton}
          onClick={() => {
            setError("");
            setMode(mode === "bootstrap" ? "signin" : "bootstrap");
          }}
          type="button"
        >
          {mode === "bootstrap"
            ? "Already signed up? Sign in"
            : "First setup? Create the super admin"}
        </button>
      )}
    </section>
  );
}
