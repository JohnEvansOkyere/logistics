"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import styles from "../jobs/jobs.module.css";
import {
  addDriver,
  addVehicle,
  listDrivers,
  listVehicles,
  setDriverActive,
  setVehicleActive,
} from "./transportApi";
import type { Driver, Vehicle } from "./transportApi";

/** Drivers and vehicles are records staff assign; drivers do not sign in. */
export function TransportRecords() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [registration, setRegistration] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    try {
      const [driverList, vehicleList] = await Promise.all([
        listDrivers(),
        listVehicles(),
      ]);
      setDrivers(driverList);
      setVehicles(vehicleList);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Records could not be loaded",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError("");
    try {
      await action();
      after?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>TRANSPORT</p>
          <h1 className={styles.title}>Drivers and vehicles</h1>
          <p className={styles.muted}>
            Staff assign these to deliveries. Drivers do not sign in. Taking a
            record out of service keeps it on past waybills.
          </p>
        </div>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="drivers-title">
          <h2 id="drivers-title">Drivers</h2>
          {drivers.length === 0 && (
            <p className={styles.muted}>No drivers yet.</p>
          )}
          <ul className={styles.list}>
            {drivers.map((driver) => (
              <li key={driver.id}>
                {driver.name} · {driver.phone}
                {driver.deactivatedAt ? " · out of service" : ""}{" "}
                <button
                  className={styles.secondaryButton}
                  onClick={() =>
                    void run(() =>
                      setDriverActive(driver.id, driver.deactivatedAt !== null),
                    )
                  }
                  type="button"
                >
                  {driver.deactivatedAt ? "Return to service" : "Take out"}
                </button>
              </li>
            ))}
          </ul>
          <form
            className={styles.form}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(
                () => addDriver({ name: name.trim(), phone: phone.trim() }),
                () => {
                  setName("");
                  setPhone("");
                },
              );
            }}
          >
            <label className={styles.field}>
              Name
              <input
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className={styles.field}>
              Phone
              <input
                onChange={(event) => setPhone(event.target.value)}
                required
                value={phone}
              />
            </label>
            <button className={styles.button} type="submit">
              Add driver
            </button>
          </form>
        </section>

        <section className={styles.card} aria-labelledby="vehicles-title">
          <h2 id="vehicles-title">Vehicles</h2>
          {vehicles.length === 0 && (
            <p className={styles.muted}>No vehicles yet.</p>
          )}
          <ul className={styles.list}>
            {vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                {vehicle.registration}
                {vehicle.description ? ` · ${vehicle.description}` : ""}
                {vehicle.deactivatedAt ? " · out of service" : ""}{" "}
                <button
                  className={styles.secondaryButton}
                  onClick={() =>
                    void run(() =>
                      setVehicleActive(
                        vehicle.id,
                        vehicle.deactivatedAt !== null,
                      ),
                    )
                  }
                  type="button"
                >
                  {vehicle.deactivatedAt ? "Return to service" : "Take out"}
                </button>
              </li>
            ))}
          </ul>
          <form
            className={styles.form}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(
                () =>
                  addVehicle({
                    registration: registration.trim(),
                    description: description.trim() || undefined,
                  }),
                () => {
                  setRegistration("");
                  setDescription("");
                },
              );
            }}
          >
            <label className={styles.field}>
              Registration
              <input
                onChange={(event) => setRegistration(event.target.value)}
                required
                value={registration}
              />
            </label>
            <label className={styles.field}>
              Description (optional)
              <input
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </label>
            <button className={styles.button} type="submit">
              Add vehicle
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
