"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "./authenticatedFetch";

type StaffAccessState = {
  status: "loading" | "ready" | "unavailable";
  roles: string[];
};

export function useStaffAccess() {
  const [access, setAccess] = useState<StaffAccessState>({
    status: "loading",
    roles: [],
  });

  useEffect(() => {
    let active = true;
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";

    void authenticatedFetch(`${apiBase}/v1/auth/session`)
      .then(async (response) => {
        if (response.status === 403) {
          return [];
        }
        if (!response.ok) {
          throw new Error("Staff access could not be checked");
        }
        const session = (await response.json()) as { roles?: unknown };
        return Array.isArray(session.roles)
          ? session.roles.filter(
              (role): role is string => typeof role === "string",
            )
          : [];
      })
      .then((roles) => {
        if (active) setAccess({ status: "ready", roles });
      })
      .catch(() => {
        if (active) setAccess({ status: "unavailable", roles: [] });
      });

    return () => {
      active = false;
    };
  }, []);

  const isSuperAdmin = access.roles.includes("super_admin");
  return {
    ...access,
    isSuperAdmin,
    isDepartmentStaff: access.roles.length > 0 && !isSuperAdmin,
  };
}
