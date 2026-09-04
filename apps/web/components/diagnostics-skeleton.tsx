"use client";

export function DiagnosticsSkeleton({
  cards = 3,
  rows = 4,
  singleColumn = false
}: {
  cards?: number;
  rows?: number;
  singleColumn?: boolean;
}) {
  return (
    <section
      className="cards"
      style={singleColumn ? { gridTemplateColumns: "1fr" } : undefined}
    >
      {Array.from({ length: cards }, (_, cardIndex) => (
        <article key={cardIndex} className="card">
          <div className="loading-bar" style={{ width: 160, height: 14, marginBottom: 16 }} />
          <div className="matrix-list">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <div key={rowIndex} className="matrix-row">
                <div style={{ width: "100%" }}>
                  <div className="loading-bar" style={{ width: "38%", height: 12, marginBottom: 8 }} />
                  <div className="loading-bar" style={{ width: "72%", height: 12 }} />
                </div>
                <div className="matrix-meta" style={{ minWidth: 120 }}>
                  <div className="loading-bar" style={{ width: 64, height: 12 }} />
                  <div className="loading-bar" style={{ width: 92, height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
