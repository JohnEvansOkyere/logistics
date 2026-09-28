import Link from "next/link";
import { SignInForm } from "./SignInForm";
import styles from "./signIn.module.css";

export const metadata = {
  title: "Staff sign in | BJH Logistics",
  description: "Sign in to the local BJH Logistics staff workspace.",
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
