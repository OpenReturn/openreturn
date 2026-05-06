"use client";

import { useMemo, useState } from "react";
import { Check, Download, MapPin, PackageCheck, Search, Truck } from "lucide-react";
import type {
  CarrierCode,
  ExchangeItem,
  OpenReturnRecord,
  Order,
  ResolutionType,
  ReturnReasonCode
} from "@openreturn/types";
import { CARRIER_CODES, RESOLUTION_TYPES, RETURN_REASON_CODES } from "@openreturn/types";

type Step = "lookup" | "reason" | "exchange" | "carrier" | "label";

const reasonLabels: Record<ReturnReasonCode, string> = {
  defect: "Defect",
  size: "Size issue",
  not_as_described: "Not as described",
  wrong_item: "Wrong item",
  arrived_late: "Arrived late",
  damaged_in_transit: "Damaged in transit",
  duplicate_order: "Duplicate order",
  changed_mind: "Changed mind",
  unwanted: "Unwanted",
  other: "Other"
};

const resolutionLabels: Record<ResolutionType, string> = {
  refund: "Refund",
  exchange: "Exchange",
  store_credit: "Store credit",
  coupon_code: "Coupon code"
};

const carrierServiceLevels: Record<CarrierCode, string[]> = {
  postnl: ["standard", "evening", "pickup-point"],
  dhl: ["standard", "parcelshop", "express"],
  ups: ["standard", "express-saver", "access-point"],
  dpd: ["standard", "pickup", "predict"],
  budbee: ["box", "home-pickup"]
};

const flowSteps: { id: Step; label: string }[] = [
  { id: "lookup", label: "Order" },
  { id: "reason", label: "Reason" },
  { id: "exchange", label: "Exchange" },
  { id: "carrier", label: "Carrier" },
  { id: "label", label: "Label" }
];

export function ReturnFlow() {
  const [step, setStep] = useState<Step>("lookup");
  const [orderId, setOrderId] = useState("ORDER-1001");
  const [email, setEmail] = useState("customer@example.com");
  const [order, setOrder] = useState<Order | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [reason, setReason] = useState<ReturnReasonCode>("size");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState<ResolutionType>("refund");
  const [returnRecord, setReturnRecord] = useState<OpenReturnRecord | null>(null);
  const [replacementSku, setReplacementSku] = useState("");
  const [carrier, setCarrier] = useState<CarrierCode>("postnl");
  const [serviceLevel, setServiceLevel] = useState(carrierServiceLevels.postnl[0]);
  const [dropoffPointId, setDropoffPointId] = useState("AMS-DAMRAK-01");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedItems = useMemo(
    () => order?.items.filter((item) => selectedItemIds.includes(item.id)) ?? [],
    [order, selectedItemIds]
  );
  const visibleSteps = useMemo(
    () => flowSteps.filter((candidate) => resolution === "exchange" || candidate.id !== "exchange"),
    [resolution]
  );
  const activeStepIndex = Math.max(
    0,
    visibleSteps.findIndex((candidate) => candidate.id === step)
  );

  async function lookupOrder() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(email)}`);
      const payload = (await response.json()) as { order?: Order; error?: { message: string } };
      if (!response.ok || !payload.order) {
        throw new Error(payload.error?.message ?? "Order lookup failed");
      }
      setOrder(payload.order);
      setSelectedItemIds(payload.order.items.map((item) => item.id));
      setStep("reason");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function initiateReturn() {
    if (!order || selectedItems.length === 0) {
      setError("Select at least one item to return.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          externalOrderId: order.externalOrderId,
          customer: order.customer,
          requestedResolution: resolution,
          returnMethod: resolution === "exchange" ? "exchange" : "return-to-warehouse",
          items: selectedItems.map((item) => ({
            orderItemId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: 1,
            reason: {
              code: reason,
              note: note || undefined
            }
          }))
        })
      });
      const payload = (await response.json()) as { return?: OpenReturnRecord; error?: { message: string } };
      if (!response.ok || !payload.return) {
        throw new Error(payload.error?.message ?? "Return initiation failed");
      }
      setReturnRecord(payload.return);
      setStep(resolution === "exchange" ? "exchange" : "carrier");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Return initiation failed");
    } finally {
      setBusy(false);
    }
  }

  async function selectExchange() {
    if (!returnRecord) {
      return;
    }
    const requestedItems: ExchangeItem[] = selectedItems.map((item) => ({
      originalOrderItemId: item.id,
      replacementSku: replacementSku || `${item.sku}-ALT`,
      replacementName: `${item.name} replacement`,
      quantity: 1,
      attributes: { requestedBy: "portal" }
    }));
    await mutateReturn(`/api/returns/${returnRecord.id}/exchange`, { requestedItems }, "carrier");
  }

  async function selectCarrier() {
    if (!returnRecord) {
      return;
    }
    await mutateReturn(
      `/api/returns/${returnRecord.id}/carrier`,
      { carrier, serviceLevel, dropoffPointId },
      "label"
    );
  }

  async function mutateReturn(path: string, body: unknown, nextStep: Step) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { return?: OpenReturnRecord; error?: { message: string } };
      if (!response.ok || !payload.return) {
        throw new Error(payload.error?.message ?? "Return update failed");
      }
      setReturnRecord(payload.return);
      setStep(nextStep);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Return update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two-column">
      <section className="panel" aria-labelledby="flow-title">
        <div className="page-heading">
          <h1 id="flow-title">Return flow</h1>
          <p className="muted">Lookup an order, capture a structured reason, choose a resolution, and generate a label.</p>
        </div>

        <ol className="stepper" aria-label="Return progress">
          {visibleSteps.map((candidate, index) => (
            <li
              className={index === activeStepIndex ? "active" : index < activeStepIndex ? "complete" : ""}
              key={candidate.id}
            >
              <span>{index + 1}</span>
              {candidate.label}
            </li>
          ))}
        </ol>

        <div aria-live="polite" className="sr-status">
          {status}
        </div>
        {error ? <p className="danger" role="alert">{error}</p> : null}

        {step === "lookup" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setStatus("Looking up order");
              void lookupOrder();
            }}
          >
            <div className="field">
              <label htmlFor="order-id">Order number</label>
              <input id="order-id" value={orderId} onChange={(event) => setOrderId(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="order-email">Email</label>
              <input
                id="order-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button type="submit" disabled={busy}>
              <Search size={18} aria-hidden="true" />
              Find order
            </button>
          </form>
        ) : null}

        {step === "reason" && order ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setStatus("Creating return request");
              void initiateReturn();
            }}
          >
            <fieldset>
              <legend>Items</legend>
              <div className="item-list">
                {order.items.map((item, index) => (
                  <label className="choice" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={(event) => {
                        setSelectedItemIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id)
                        );
                      }}
                    />
                    <span className={`item-swatch swatch-${index % 4}`} aria-hidden="true" />
                    <span>
                      <strong>{item.name}</strong>
                      <br />
                      <span className="muted">
                        {item.sku} - {formatMoney(item.unitPrice)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="reason">Reason</label>
              <select id="reason" value={reason} onChange={(event) => setReason(event.target.value as ReturnReasonCode)}>
                {RETURN_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {reasonLabels[code]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reason-note">Details</label>
              <textarea id="reason-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>

            <fieldset>
              <legend>Resolution</legend>
              <div className="segmented">
                {RESOLUTION_TYPES.map((option) => (
                  <label className="choice" key={option}>
                    <input
                      type="radio"
                      name="resolution"
                      value={option}
                      checked={resolution === option}
                      onChange={() => setResolution(option)}
                    />
                    <span>{resolutionLabels[option]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" disabled={busy}>
              <PackageCheck size={18} aria-hidden="true" />
              Continue
            </button>
          </form>
        ) : null}

        {step === "exchange" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setStatus("Reserving exchange items");
              void selectExchange();
            }}
          >
            <div className="field">
              <label htmlFor="replacement-sku">Replacement SKU</label>
              <input
                id="replacement-sku"
                value={replacementSku}
                onChange={(event) => setReplacementSku(event.target.value)}
                placeholder="Optional replacement SKU"
              />
            </div>
            <p className="muted">
              Exchange reservations are attached to the return before a carrier label is generated.
            </p>
            <button type="submit" disabled={busy}>
              <Check size={18} aria-hidden="true" />
              Reserve exchange
            </button>
          </form>
        ) : null}

        {step === "carrier" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setStatus("Generating shipping label");
              void selectCarrier();
            }}
          >
            <div className="field">
              <label htmlFor="carrier">Carrier</label>
              <select
                id="carrier"
                value={carrier}
                onChange={(event) => {
                  const nextCarrier = event.target.value as CarrierCode;
                  setCarrier(nextCarrier);
                  setServiceLevel(carrierServiceLevels[nextCarrier][0]);
                }}
              >
                {CARRIER_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="service-level">Service</label>
              <select
                id="service-level"
                value={serviceLevel}
                onChange={(event) => setServiceLevel(event.target.value)}
              >
                {carrierServiceLevels[carrier].map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dropoff-point">Drop-off point</label>
              <input
                id="dropoff-point"
                value={dropoffPointId}
                onChange={(event) => setDropoffPointId(event.target.value)}
              />
            </div>
            <button type="submit" disabled={busy}>
              <Truck size={18} aria-hidden="true" />
              Generate label
            </button>
          </form>
        ) : null}

        {step === "label" && returnRecord?.label ? (
          <div className="grid">
            <h2>Label ready</h2>
            <p>
              Return <strong>{returnRecord.id}</strong> is ready for shipment with{" "}
              {returnRecord.label.carrier}.
            </p>
            <div className="toolbar">
              <a className="button" href={returnRecord.label.labelUrl}>
                <Download size={18} aria-hidden="true" />
                Download label
              </a>
              <a className="button secondary" href={`/returns/${returnRecord.id}`}>
                Track return
              </a>
            </div>
            <div className="label-meta">
              <span>
                <Truck size={16} aria-hidden="true" />
                {returnRecord.label.trackingNumber}
              </span>
              <span>
                <MapPin size={16} aria-hidden="true" />
                {dropoffPointId}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="panel" aria-labelledby="summary-title">
        <h2 id="summary-title">Current return</h2>
        {order ? (
          <div className="summary-block">
            <p>
              <strong>Order:</strong> {order.externalOrderId ?? order.id}
            </p>
            <p>
              <strong>Customer:</strong> {order.customer.email}
            </p>
            <p>
              <strong>Total:</strong> {formatMoney(order.total)}
            </p>
            <div className="mini-list" aria-label="Selected items">
              {selectedItems.map((item) => (
                <span key={item.id}>
                  {item.name}
                  <small>{item.sku}</small>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">Order details appear after lookup.</p>
        )}
        {returnRecord ? (
          <div className="grid">
            <p>
              <span className="status-pill">{returnRecord.status.replaceAll("_", " ")}</span>
            </p>
            <p>
              <strong>Resolution:</strong> {resolutionLabels[returnRecord.requestedResolution]}
            </p>
            <p>
              <strong>Reason:</strong> {returnRecord.reasonCodes.map((code) => reasonLabels[code]).join(", ")}
            </p>
            {returnRecord.label ? (
              <p>
                <strong>Tracking:</strong> {returnRecord.label.trackingNumber}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="muted">The return record appears after the request is created.</p>
        )}
      </aside>
    </div>
  );
}

function formatMoney(value: { amount: number; currency: string }): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: value.currency
  }).format(value.amount / 100);
}

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
