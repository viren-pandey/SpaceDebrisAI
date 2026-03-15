import { Link } from "react-router-dom";

export default function ApiTerms() {
  return (
    <div className="docs-root">
      <main className="docs-main" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="docs-page-header">
          <p className="docs-eyebrow">API Terms</p>
          <h1 className="docs-h1">Polling and fair-use terms</h1>
          <p className="docs-h1-sub">
            Every API key is issued against this policy. Repeated violations are throttled and then banned automatically.
          </p>
        </div>

        <section className="docs-section">
          <h2 className="docs-section-title">Rules</h2>
          <div className="docs-limits-grid">
            <div className="docs-limit-card">
              <div className="docs-limit-val">10s</div>
              <div className="docs-limit-label">minimum poll interval</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">60</div>
              <div className="docs-limit-label">requests per minute</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">3</div>
              <div className="docs-limit-label">violations before auto-ban</div>
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="docs-section-title">What counts as abuse</h2>
          <p className="docs-p">Polling the same live endpoints faster than once every 10 seconds.</p>
          <p className="docs-p">Bursting above 60 authenticated requests per minute.</p>
          <p className="docs-p">Continuing to retry after receiving a `429` fair-use response.</p>
        </section>

        <section className="docs-section">
          <h2 className="docs-section-title">Enforcement</h2>
          <p className="docs-p">The first repeated violations return `429` responses with a fair-use warning and a `Retry-After` header.</p>
          <p className="docs-p">After 3 recent violations, the backend disables the API key automatically and future requests return `403`.</p>
          <p className="docs-p">Banned keys must be reissued by the site owner. Rotating requests across tabs or jobs does not bypass enforcement.</p>
          <p className="docs-p">Deployment owners can exempt their own trusted IPs, emails, or keys with `RATE_LIMIT_EXEMPT_IPS`, `RATE_LIMIT_EXEMPT_EMAILS`, and `RATE_LIMIT_EXEMPT_API_KEYS`.</p>
        </section>

        <section className="docs-section">
          <h2 className="docs-section-title">Before you generate a key</h2>
          <p className="docs-p">Use browser refresh sparingly, cache responses locally, and schedule automation no faster than the published interval.</p>
          <p className="docs-p">
            Return to the <Link to="/api" className="docs-link">API page</Link> once you are ready to accept these terms and issue a key.
          </p>
        </section>
      </main>
    </div>
  );
}
