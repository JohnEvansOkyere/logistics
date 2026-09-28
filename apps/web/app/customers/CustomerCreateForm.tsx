"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { createCustomer } from "./customerApi";
import styles from "./customerDirectory.module.css";

export function CustomerCreateForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const customer = await createCustomer({
        companyName,
        contactName,
        email,
      });
      router.push(`/customers/${customer.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The customer could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.customerForm} onSubmit={submit}>
      <div className={styles.customerFormFields}>
        <label className={styles.customerFormField} htmlFor="company-name">
          Company name <span aria-hidden="true">*</span>
          <input
            autoComplete="organization"
            id="company-name"
            maxLength={160}
            onChange={(event) => setCompanyName(event.target.value)}
            required
            value={companyName}
          />
        </label>
        <label className={styles.customerFormField} htmlFor="contact-name">
          Primary contact <span aria-hidden="true">*</span>
          <input
            autoComplete="name"
            id="contact-name"
            maxLength={160}
            onChange={(event) => setContactName(event.target.value)}
            required
            value={contactName}
          />
        </label>
        <label className={styles.customerFormField} htmlFor="contact-email">
          Contact email <span aria-hidden="true">*</span>
          <input
            autoComplete="email"
            id="contact-email"
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
      </div>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.formActions}>
        <Link className={styles.formCancel} href="/customers">
          Cancel
        </Link>
        <button className={styles.formSubmit} disabled={saving} type="submit">
          {saving ? "Saving…" : "Create customer"}
        </button>
      </div>
    </form>
  );
}
