import Link from "next/link";
import { notFound } from "next/navigation";
import type { OpenReturnRecord, ReturnEvent } from "@openreturn/types";
import { apiFetch } from "../../../lib/api";
import { StatusActions } from "../../../components/StatusActions";

interface PageProps {
  params: { id: string };
}

export default async function ReturnStatusPage({ params }: PageProps) {
  let record: OpenReturnRecord;
  let events: ReturnEvent[];
  try {
    const [returnPayload, eventsPayload] = await Promise.all([
      apiFetch<{ return: OpenReturnRecord }>(`/returns/${params.id}`),
      apiFetch<{ events: ReturnEvent[] }>(`/returns/${params.id}/events`)
    ]);
    record = returnPayload.return;
    events = eventsPayload.events;
  } catch {
    notFound();
  }

  return (
    <div className="grid two-column">
      <section className="panel" aria-labelledby="return-title">
        <div className="page-heading">
          <h1 id="return-title">Return status</h1>
          <p className="muted">{record.id}</p>
        </div>
        <div className="grid">
          <p>
            <span className="status-pill">{record.status.replaceAll("_", " ")}</span>
          </p>
          <p>
            <strong>Order:</strong> {record.orderId}
          </p>
          <p>
            <strong>Resolution:</strong> {record.requestedResolution.replaceAll("_", " ")}
          </p>
          <p>
            <strong>Items:</strong> {record.items.map((item) => item.name).join(", ")}
          </p>
          {record.label ? (
            <p>
              <strong>Label:</strong>{" "}
              <a href={record.label.labelUrl}>Download {record.label.format.toUpperCase()}</a>
            </p>
          ) : null}
          <div className="toolbar">
            <Link className="button secondary" href="/returns/new">
              Start another return
            </Link>
            <Link className="button secondary" href="/dashboard">
              Retailer dashboard
            </Link>
          </div>
        </div>
      </section>

      <StatusActions initialReturn={record} />

      <section className="panel" aria-labelledby="events-title">
        <h2 id="events-title">Event history</h2>
        <div className="timeline">
          {events.map((event) => (
            <article className="timeline-entry" key={event.id}>
              <h3>{event.message}</h3>
              <p className="muted">
                {new Date(event.createdAt).toLocaleString()} - {event.type}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
