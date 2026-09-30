"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStaffAccess } from "../auth/useStaffAccess";

/** A customer who lands on the staff overview is sent to their own portal. */
export function PortalRedirect() {
  const router = useRouter();
  const { isCustomer } = useStaffAccess();
  useEffect(() => {
    if (isCustomer) router.replace("/portal");
  }, [isCustomer, router]);
  return null;
}
