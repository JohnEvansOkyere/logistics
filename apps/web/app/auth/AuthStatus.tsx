"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabaseBrowserClient";
import styles from "./auth.module.css";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  if (!email) {
    return <Link href="/sign-in">Sign in</Link>;
  }

  return (
    <div className={styles.authStatus}>
      <span>{email}</span>
      <button className={styles.signOutButton} onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
