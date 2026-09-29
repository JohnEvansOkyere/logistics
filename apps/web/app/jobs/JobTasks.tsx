"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { staffRoleKeys, taskKinds } from "@bjh/contracts";
import type { StaffRoleKey, TaskKind } from "@bjh/contracts";
import {
  completeJobTask,
  createJobTask,
  listJobTasks,
  roleLabels,
  taskKindLabels,
} from "./jobApi";
import type { JobTask } from "./jobApi";
import styles from "./jobs.module.css";

export function JobTasks({
  jobId,
  canEdit,
}: {
  jobId: string;
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<JobTask[] | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [role, setRole] = useState<StaffRoleKey>("super_admin");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(async () => {
    try {
      setTasks(await listJobTasks(jobId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Tasks could not be loaded",
      );
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await createJobTask(jobId, {
        kind,
        title: title.trim(),
        details: details.trim() || undefined,
        assignedRole: role,
        dueDate: dueDate || undefined,
      });
      setTitle("");
      setDetails("");
      setDueDate("");
    });
  }

  return (
    <section className={styles.card} aria-labelledby="tasks-title">
      <h2 id="tasks-title">Tasks and exceptions</h2>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {tasks && tasks.length === 0 && (
        <p className={styles.muted}>No tasks on this job.</p>
      )}
      {tasks && tasks.length > 0 && (
        <ul className={styles.list}>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong> · {taskKindLabels[task.kind]} ·{" "}
              {roleLabels[task.assignedRole]}
              {task.dueDate ? ` · due ${task.dueDate}` : ""}
              {task.details ? ` — ${task.details}` : ""}
              {task.status === "done" ? (
                <span className={styles.muted}>
                  {" "}
                  · done
                  {task.completionNote ? `: ${task.completionNote}` : ""}
                </span>
              ) : (
                canEdit && (
                  <>
                    {" "}
                    <button
                      className={styles.secondaryButton}
                      onClick={() =>
                        void run(() =>
                          completeJobTask(
                            jobId,
                            task.id,
                            window.prompt("Completion note (optional)") ||
                              undefined,
                          ),
                        )
                      }
                      type="button"
                    >
                      Mark done
                    </button>
                  </>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Type
            <select
              onChange={(event) => setKind(event.target.value as TaskKind)}
              value={kind}
            >
              {taskKinds.map((item) => (
                <option key={item} value={item}>
                  {taskKindLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Title
            <input
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label className={styles.field}>
            Details (optional)
            <input
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
          </label>
          <label className={styles.field}>
            Assigned to
            <select
              onChange={(event) => setRole(event.target.value as StaffRoleKey)}
              value={role}
            >
              {staffRoleKeys.map((item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Due date (optional)
            <input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <button className={styles.button} type="submit">
            Add task
          </button>
        </form>
      )}
    </section>
  );
}
