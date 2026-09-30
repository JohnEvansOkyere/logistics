"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "./authenticatedFetch";
import { getSupabaseBrowserClient } from "./supabaseBrowserClient";

export type CustomerCompany = { companyId: string; companyName: string };

type StaffAccessState = {
  status: "loading" | "ready" | "unavailable";
  roles: string[];
  /** The companies linked to a customer account; empty for staff. */
  companies: CustomerCompany[];
};

const initial: StaffAccessState = {
  status: "loading",
  roles: [],
  companies: [],
};

export function useStaffAccess() {
  const [access, setAccess] = useState<StaffAccessState>(initial);

  useEffect(() => {
    let active = true;
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";

    // Runs on mount and again whenever someone signs in or out, because the
    // page frame that uses this stays mounted across a sign-in.
    const load = () => {
      void authenticatedFetch(`${apiBase}/v1/auth/session`)
        .then(async (response) => {
          if (response.status === 403) {
            return { roles: [], companies: [] };
          }
          if (!response.ok) {
            throw new Error("Staff access could not be checked");
          }
          const session = (await response.json()) as {
            roles?: unknown;
            companies?: unknown;
          };
          return {
            roles: Array.isArray(session.roles)
              ? session.roles.filter(
                  (role): role is string => typeof role === "string",
                )
              : [],
            companies: Array.isArray(session.companies)
              ? (session.companies as CustomerCompany[])
              : [],
          };
        })
        .then(({ roles, companies }) => {
          if (active) setAccess({ status: "ready", roles, companies });
        })
        .catch(() => {
          if (active) {
            setAccess({ status: "unavailable", roles: [], companies: [] });
          }
        });
    };

    load();
    const supabase = getSupabaseBrowserClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setAccess(initial);
        // Deferred: the client is still finishing the sign-in when this fires.
        setTimeout(load, 0);
      }
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  const isSuperAdmin = access.roles.includes("super_admin");
  return {
    ...access,
    isSuperAdmin,
    isDepartmentStaff: access.roles.length > 0 && !isSuperAdmin,
    isCustomer: access.roles.length === 0 && access.companies.length > 0,
  };
}
