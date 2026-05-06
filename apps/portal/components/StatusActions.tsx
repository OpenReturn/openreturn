"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import type { OpenReturnRecord, TrackingStatus } from "@openreturn/types";

export function StatusActions({ initialReturn }: { initialReturn: OpenReturnRecord }) {
  const [record, setRecord] = useState(initialReturn);
  const [status, setStatus] = useState<TrackingStatus>("accepted");
  const [message, setMessage] = useState("");

  async function addTracking() {
    setMessage("");
    const response = await fetch(`/api/returns/${record.id}/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, description: "Portal tracking update" })
    });
    const payload = (await response.json()) as { return?: OpenReturnRecord; error?: { message: string } };
    if (payload.return) {
      setRecord(payload.return);
      setMessage(`Status updated to ${payload.return.status.replaceAll("_", " ")}`);
    } else {
      setMessage(payload.error?.message ?? "Tracking update failed");
    }
  }

  return (
    <section className="panel" aria-labelledby="tracking-actions">
      <h2 id="tracking-actions">Tracking update</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tracking-status">Carrier status</label>
          <select
            id="tracking-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TrackingStatus)}
          >
            <option value="accepted">Accepted</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </select>
        </div>
        <button type="button" onClick={() => void addTracking()}>
          <Truck size={18} aria-hidden="true" />
          Add tracking
        </button>
        <p aria-live="polite" className="muted">
          {message || `Current state: ${record.status.replaceAll("_", " ")}`}
        </p>
      </div>
    </section>
  );
}
