import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Return not found</h1>
      <p className="muted">The requested return could not be loaded from the REST API.</p>
      <div className="toolbar">
        <Link className="button secondary" href="/returns/new">
          Start a return
        </Link>
        <Link className="button secondary" href="/dashboard">
          View dashboard
        </Link>
      </div>
    </section>
  );
}
