import Link from "next/link";
import { SignInForm } from "./SignInForm";
import styles from "./signIn.module.css";

export const metadata = {
  title: "Sign in | BJH Logistics",
  description: "Sign in to your BJH Logistics account.",
};

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Back to overview
      </Link>
      <SignInForm />
      <p className={styles.localNote}>
        Local testing only. The first local signup claims the super_admin role;
        later role provisioning is performed by the admin workflow.
      </p>
    </main>
  );
}
