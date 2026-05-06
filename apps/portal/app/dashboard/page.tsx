import Link from "next/link";
import type { OpenReturnRecord, ReturnReasonCode } from "@openreturn/types";
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
  const exchangeCount = returns.filter((record) => record.requestedResolution === "exchange").length;
  const openCount = returns.filter((record) => record.status !== "completed").length;
  const reasonCounts = new Map<ReturnReasonCode, number>();

  for (const record of returns) {
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
      </section>

      {loadError ? (
        <p className="danger" role="alert">
          Unable to load live API data. Confirm the REST API is running.
        </p>
      ) : null}

      <section className="panel" aria-labelledby="reasons-title">
        <h2 id="reasons-title">Reason distribution</h2>
        {reasonCounts.size > 0 ? (
          <div className="item-list">
            {[...reasonCounts.entries()].map(([reason, count]) => (
              <div className="return-row" key={reason}>
                <span>{reason.replaceAll("_", " ")}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No return reasons captured yet.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="returns-title">
        <h2 id="returns-title">Returns</h2>
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
                  <td>{record.reasonCodes.map((code) => code.replaceAll("_", " ")).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
