import Link from "next/link";
import { RETURN_STATES } from "@openreturn/types";
import type { OpenReturnRecord, ReturnReasonCode, ReturnState } from "@openreturn/types";
import { apiFetch } from "../../lib/api";

export default async function DashboardPage() {
  let returns: OpenReturnRecord[] = [];
  let loadError = "";
  try {
    const payload = await apiFetch<{ returns: OpenReturnRecord[] }>("/returns");
    returns = payload.returns;
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "Unable to load returns";
  }
  const total = returns.length;
  const exchangeCount = returns.filter(
    (record) => record.requestedResolution === "exchange"
  ).length;
  const openCount = returns.filter((record) => record.status !== "completed").length;
  const labelReadyCount = returns.filter((record) => Boolean(record.label)).length;
  const overdueCount = returns.filter((record) => isOlderThanDays(record.updatedAt, 7)).length;
  const reasonCounts = new Map<ReturnReasonCode, number>();
  const statusCounts = new Map<ReturnState, number>();

  for (const record of returns) {
    statusCounts.set(record.status, (statusCounts.get(record.status) ?? 0) + 1);
    for (const code of record.reasonCodes) {
      reasonCounts.set(code, (reasonCounts.get(code) ?? 0) + 1);
    }
  }

  const returnRate = total === 0 ? 0 : Math.round((total / Math.max(total, 100)) * 100);

  return (
    <div className="grid">
      <div className="page-heading">
        <h1>Retailer dashboard</h1>
        <p className="muted">Operational overview, return reasons, and exchange preservation.</p>
      </div>

      <section className="metrics" aria-label="Return analytics">
        <div className="metric">
          <span className="muted">Return rate</span>
          <strong>{returnRate}%</strong>
        </div>
        <div className="metric">
          <span className="muted">Open returns</span>
          <strong>{openCount}</strong>
        </div>
        <div className="metric">
          <span className="muted">Exchange share</span>
          <strong>{total === 0 ? 0 : Math.round((exchangeCount / total) * 100)}%</strong>
        </div>
        <div className="metric">
          <span className="muted">Labels generated</span>
          <strong>{labelReadyCount}</strong>
        </div>
        <div className="metric">
          <span className="muted">Needs attention</span>
          <strong>{overdueCount}</strong>
        </div>
      </section>

      {loadError ? (
        <p className="danger" role="alert">
          Unable to load live API data. Confirm the REST API is running.
        </p>
      ) : null}

      <section className="panel" aria-labelledby="reasons-title">
        <h2 id="reasons-title">Reason distribution</h2>
        {reasonCounts.size > 0 ? (
          <div className="bar-list">
            {[...reasonCounts.entries()].map(([reason, count]) => {
              const width = total === 0 ? 0 : Math.max(8, Math.round((count / total) * 100));
              return (
                <div className="bar-row" key={reason}>
                  <div>
                    <span>{reason.replaceAll("_", " ")}</span>
                    <strong>{count}</strong>
                  </div>
                  <span className="bar-track" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No return reasons captured yet.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="pipeline-title">
        <h2 id="pipeline-title">Status pipeline</h2>
        <div className="pipeline" aria-label="Returns by lifecycle status">
          {RETURN_STATES.map((state) => (
            <div key={state}>
              <span>{state.replaceAll("_", " ")}</span>
              <strong>{statusCounts.get(state) ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="returns-title">
        <div className="section-heading">
          <h2 id="returns-title">Returns</h2>
          <Link className="button secondary" href="/returns/new">
            Start return
          </Link>
        </div>
        {returns.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Resolution</th>
                  <th>Reasons</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <Link href={`/returns/${record.id}`}>{record.id.slice(0, 8)}</Link>
                    </td>
                    <td>{record.orderId}</td>
                    <td>{record.customer.email}</td>
                    <td>
                      <span className="status-pill">{record.status.replaceAll("_", " ")}</span>
                    </td>
                    <td>{record.requestedResolution.replaceAll("_", " ")}</td>
                    <td>
                      {record.reasonCodes.map((code) => code.replaceAll("_", " ")).join(", ")}
                    </td>
                    <td>{new Date(record.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="muted">No returns have been created yet.</p>
            <Link className="button" href="/returns/new">
              Start the first return
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function isOlderThanDays(date: string, days: number): boolean {
  const ageMs = Date.now() - new Date(date).getTime();
  return ageMs > days * 24 * 60 * 60 * 1000;
}
