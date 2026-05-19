import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { siteContent } from './generated-site-content';
import './styles.css';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/">
          Smart Deployment
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          {siteContent.navLinks.map((link) =>
            link.href.startsWith('http') ? (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ) : (
              <NavLink key={link.href} to={link.href}>
                {link.label}
              </NavLink>
            )
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}

function ArchitectureDiagram({ diagram }: { diagram: typeof siteContent.architecture.diagram }) {
  const [scale, setScale] = useState(1);
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));

  return (
    <div className="architecture-panel">
      <div className="architecture-toolbar" aria-label="Architecture diagram controls">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setScale((value) => Math.max(0.75, value - 0.1))}
        >
          -
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setScale((value) => Math.min(1.4, value + 0.1))}
        >
          +
        </button>
        <button type="button" aria-label="Reset diagram zoom" title="Reset diagram zoom" onClick={() => setScale(1)}>
          reset
        </button>
      </div>
      <div className="architecture-stage">
        <svg role="img" aria-label="Smart Deployment architecture diagram" viewBox="0 0 1040 270">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <g
            className="architecture-viewport"
            transform={`translate(${(1 - scale) * 520} ${(1 - scale) * 135}) scale(${scale})`}
          >
            <g className="architecture-edges">
              {diagram.edges.map(([from, to]) => {
                const source = nodeMap.get(from)!;
                const target = nodeMap.get(to)!;
                const startX = source.x + 170;
                const startY = source.y + 26;
                const endX = target.x;
                const endY = target.y + 26;
                const curve = Math.max(36, (endX - startX) / 2);
                return (
                  <path
                    key={`${from}-${to}`}
                    d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
                  />
                );
              })}
            </g>
            <g className="architecture-nodes">
              {diagram.nodes.map((node) => (
                <g className="architecture-node" key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <rect width="170" height="52" rx="8" />
                  <text x="85" y="31" textAnchor="middle">
                    {node.label}
                  </text>
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Home() {
  const { hero, operatingModel } = siteContent;

  return (
    <Shell>
      <main>
        <section className="hero">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.lead}</p>
          <div className="actions">
            <Link className="button button-primary" to={hero.primary.href}>
              {hero.primary.label}
            </Link>
            <Link className="button button-secondary" to={hero.secondary.href}>
              {hero.secondary.label}
            </Link>
          </div>
        </section>

        <section className="command-grid" aria-label="Primary command surface">
          {siteContent.commands.map((item) => (
            <article className="command-card" key={item.name}>
              <h2>{item.name}</h2>
              <p>{item.body}</p>
              <pre>
                <code>{item.command}</code>
              </pre>
            </article>
          ))}
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">{operatingModel.eyebrow}</p>
            <h2>{operatingModel.title}</h2>
          </div>
          <div className="flow-diagram" aria-label="Deployment flow">
            {operatingModel.steps.map((step) => (
              <div key={step}>{step}</div>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Architecture() {
  const { architecture } = siteContent;

  return (
    <Shell>
      <main>
        <section className="page-header">
          <p className="eyebrow">{architecture.eyebrow}</p>
          <h1>{architecture.title}</h1>
          <p className="lead">{architecture.lead}</p>
        </section>

        <section className="layer-stack" aria-label="Architecture layers">
          {architecture.layers.map((layer, index) => (
            <article className="layer-card" key={layer.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{layer.title}</h2>
                <p>{layer.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="diagram-section">
          <div>
            <p className="eyebrow">{architecture.diagram.eyebrow}</p>
            <h2>{architecture.diagram.title}</h2>
            <p>{architecture.diagram.body}</p>
          </div>
          <ArchitectureDiagram diagram={architecture.diagram} />
        </section>

        <section className="diagram-section">
          <div>
            <p className="eyebrow">{architecture.process.eyebrow}</p>
            <h2>{architecture.process.title}</h2>
            <p>{architecture.process.body}</p>
          </div>
          <div className="process-list" aria-label="Deployment process artifacts">
            {architecture.process.artifacts.map((artifact) => (
              <span key={artifact}>{artifact}</span>
            ))}
          </div>
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Resilience</p>
            <h2>Known risks are surfaced as product behavior.</h2>
          </div>
          <ul className="risk-list">
            {architecture.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">{architecture.aiBoundary.eyebrow}</p>
            <h2>{architecture.aiBoundary.title}</h2>
          </div>
          <div className="split-panel">
            {architecture.aiBoundary.panels.map((panel) => (
              <article key={panel.title}>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Docs() {
  const { docs } = siteContent;
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDocs = docs.pages.filter((doc) => {
    if (!normalizedQuery) return true;

    return [doc.title, doc.body, ...doc.sections.flatMap((section) => [section.title, section.body, ...section.items])]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <Shell>
      <main>
        <section className="page-header">
          <p className="eyebrow">{docs.eyebrow}</p>
          <h1>{docs.title}</h1>
          <p className="lead">{docs.lead}</p>
        </section>

        <section className="docs-catalog" aria-label="Documentation catalog">
          <label className="docs-search">
            <span>Search documentation</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands, AI, release, parser safety..."
            />
          </label>

          <div className="doc-detail">
            {filteredDocs.map((doc, index) => (
              <details className="doc-section" id={doc.slug} key={doc.slug} open={index === 0 || Boolean(query)}>
                <summary>
                  <span>{doc.eyebrow}</span>
                  <strong>{doc.title}</strong>
                  <p>{doc.body}</p>
                </summary>
                <div className="doc-section-body">
                  {doc.sections.map((section) => (
                    <article key={section.title}>
                      <h2>{section.title}</h2>
                      {section.body ? <p>{section.body}</p> : null}
                      {section.items.length > 0 ? (
                        <ul>
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </details>
            ))}
            {filteredDocs.length === 0 ? <p className="docs-empty">No matching documentation found.</p> : null}
          </div>
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">{docs.nextStep.eyebrow}</p>
            <h2>{docs.nextStep.title}</h2>
          </div>
          <div className="split-panel">
            {docs.nextStep.panels.map((panel) => (
              <article key={panel.title}>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
                {panel.href.startsWith('#') ? (
                  <a className="text-link" href={panel.href}>
                    {panel.label}
                  </a>
                ) : panel.internal ? (
                  <Link className="text-link" to={panel.href}>
                    {panel.label}
                  </Link>
                ) : (
                  <a className="text-link" href={panel.href}>
                    {panel.label}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
