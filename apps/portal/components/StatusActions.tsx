"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Gift,
  PackageCheck,
  Truck
} from "lucide-react";
import type { OpenReturnRecord, ReturnState, TrackingStatus } from "@openreturn/types";

const trackingOptions: { value: TrackingStatus; label: string }[] = [
  { value: "accepted", label: "Accepted by carrier" },
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered to warehouse" },
  { value: "exception", label: "Carrier exception" }
];

export function StatusActions({ initialReturn }: { initialReturn: OpenReturnRecord }) {
  const router = useRouter();
  const [record, setRecord] = useState(initialReturn);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("accepted");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const nextActions = useMemo(() => buildNextActions(record), [record]);

  async function addTracking() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/returns/${record.id}/track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: trackingStatus, description: "Portal tracking update" })
      });
      await applyPayload(response, "Tracking update failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateLifecycle(status: ReturnState) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/returns/${record.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildLifecyclePayload(record, status))
      });
      await applyPayload(response, "Lifecycle update failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyPayload(response: Response, fallbackMessage: string) {
    const payload = (await response.json()) as {
      return?: OpenReturnRecord;
      error?: { message: string };
    };
    if (!response.ok || !payload.return) {
      setMessage(payload.error?.message ?? fallbackMessage);
      return;
    }
    setRecord(payload.return);
    setMessage(`Return moved to ${payload.return.status.replaceAll("_", " ")}`);
    router.refresh();
  }

  return (
    <section className="panel" aria-labelledby="tracking-actions">
      <div className="section-heading">
        <h2 id="tracking-actions">Operations</h2>
        <span className="status-pill">{record.status.replaceAll("_", " ")}</span>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="tracking-status">Carrier status</label>
          <select
            id="tracking-status"
            value={trackingStatus}
            onChange={(event) => setTrackingStatus(event.target.value as TrackingStatus)}
          >
            {trackingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void addTracking()} disabled={busy}>
          <Truck size={18} aria-hidden="true" />
          Add tracking
        </button>
      </div>

      {nextActions.length > 0 ? (
        <div className="action-grid" aria-label="Lifecycle actions">
          {nextActions.map((action) => (
            <button
              className="secondary"
              type="button"
              key={action.status}
              onClick={() => void updateLifecycle(action.status)}
              disabled={busy}
            >
              <action.Icon size={18} aria-hidden="true" />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <p aria-live="polite" className={message.includes("failed") ? "danger" : "muted"}>
        {message || "Carrier and warehouse updates appear immediately in the event history."}
      </p>
    </section>
  );
}

function buildLifecyclePayload(record: OpenReturnRecord, status: ReturnState) {
  if (status === "inspection") {
    return {
      status,
      inspection: {
        inspectedAt: new Date().toISOString(),
        accepted: true,
        notes: "Inspection started from the reference portal."
      }
    };
  }
  if (status === "refunded") {
    return {
      status,
      refund: {
        amount: { amount: 100, currency: "EUR" },
        provider: "stripe",
        transactionId: `portal-${record.id.slice(0, 8)}`,
        processedAt: new Date().toISOString()
      }
    };
  }
  if (status === "completed" && record.requestedResolution === "store_credit") {
    return {
      status,
      storeCredit: {
        amount: { amount: 100, currency: "EUR" },
        code: `CREDIT-${record.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString()
      }
    };
  }
  if (status === "completed" && record.requestedResolution === "coupon_code") {
    return {
      status,
      couponCode: {
        code: `RETURN-${record.id.slice(0, 8).toUpperCase()}`,
        percentage: 10,
        issuedAt: new Date().toISOString()
      }
    };
  }
  return { status };
}

function buildNextActions(record: OpenReturnRecord) {
  switch (record.status) {
    case "delivered":
      return [{ status: "inspection" as const, label: "Start inspection", Icon: ClipboardCheck }];
    case "inspection":
      return [{ status: "approved" as const, label: "Approve return", Icon: CheckCircle2 }];
    case "approved":
      switch (record.requestedResolution) {
        case "exchange":
          return [{ status: "exchanged" as const, label: "Complete exchange", Icon: PackageCheck }];
        case "store_credit":
          return [{ status: "completed" as const, label: "Issue store credit", Icon: Gift }];
        case "coupon_code":
          return [{ status: "completed" as const, label: "Issue coupon", Icon: BadgePercent }];
        default:
          return [{ status: "refunded" as const, label: "Process refund", Icon: CreditCard }];
      }
    case "refunded":
    case "exchanged":
    case "rejected":
      return [{ status: "completed" as const, label: "Close return", Icon: CheckCircle2 }];
    default:
      return [];
  }
}
