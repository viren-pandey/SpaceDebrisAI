export default function BackendOfflineNotice({ title = "Backend offline", detail = "", compact = false }) {
  return (
    <section className={`offline-banner${compact ? " offline-banner--compact" : ""}`}>
      <div className="offline-banner-copy">
        <p className="offline-banner-eyebrow">404 vibes | timeout energy | one-person ops</p>
        <h2 className="offline-banner-title">{title}</h2>
        <p className="offline-banner-text">
          Backend is offline, but you are online. Have a look at the docs while our force of 1 employee is looking at it.
        </p>
        {detail ? <p className="offline-banner-detail">{detail}</p> : null}
      </div>
      <pre className="offline-banner-meme" aria-label="Backend offline meme">
{String.raw`   /\_/\\
  ( o.o )   backend.exe
   > ^ <    has left the chat

  you: still online
  ops: 1 employee`}
      </pre>
    </section>
  );
}
