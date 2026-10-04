"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { staffRoleKeys } from "@bjh/contracts";
import { listTasks, roleLabels, taskKindLabels } from "../jobs/jobApi";
import type { JobTask } from "../jobs/jobApi";
import styles from "../jobs/jobs.module.css";

export function TaskList() {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"open" | "all">("open");
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setState("loading");
    listTasks(role, status)
      .then((result) => {
        if (active) {
          setTasks(result);
          setState("ready");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Tasks are unavailable",
          );
          setState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [role, status]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Tasks</h1>
        </div>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          Assigned to
          <select
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            <option value="">Everyone</option>
            {staffRoleKeys.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Show
          <select
            onChange={(event) =>
              setStatus(event.target.value as "open" | "all")
            }
            value={status}
          >
            <option value="open">Open tasks</option>
            <option value="all">Open and done</option>
          </select>
        </label>
      </div>

      {state === "loading" && <p role="status">Loading tasks…</p>}
      {state === "error" && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {state === "ready" &&
        (tasks.length === 0 ? (
          <p className={styles.muted}>No tasks.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Job</th>
                  <th scope="col">Type</th>
                  <th scope="col">Assigned to</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <th scope="row">{task.title}</th>
                    <td>
                      <Link
                        className={styles.link}
                        href={`/jobs/${task.jobId}`}
                      >
                        {task.fileNumber}
                      </Link>{" "}
                      · {task.customerCompanyName}
                    </td>
                    <td>{taskKindLabels[task.kind]}</td>
                    <td>{roleLabels[task.assignedRole]}</td>
                    <td>{task.dueDate ?? "—"}</td>
                    <td>
                      <span className={styles.badge}>
                        {task.status === "done" ? "Done" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </main>
  );
}
