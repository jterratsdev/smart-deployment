import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './styles.css';

const commands = [
  {
    name: 'analyze',
    command: 'sf smart-deployment analyze --source-path force-app --use-ai',
    body: 'Scans metadata, builds a dependency graph, detects cycles, and produces staged deployment waves.',
  },
  {
    name: 'validate',
    command: 'sf smart-deployment validate --source-path force-app --use-ai',
    body: 'Checks project readiness and summarizes deployment, parser, and AI-assisted risk signals.',
  },
  {
    name: 'start',
    command: 'sf smart-deployment start --source-path force-app --target-org myorg',
    body: 'Executes staged deployments with local state, retry support, and resumable progress tracking.',
  },
];

const layers = [
  {
    title: 'Command Layer',
    body: 'Thin oclif commands parse flags, load configuration, and delegate to services with typed presenters.',
  },
  {
    title: 'Analysis Services',
    body: 'Project scanners, parsers, dependency graph builders, and reporters produce deterministic deployment context.',
  },
  {
    title: 'Wave Engine',
    body: 'Wave builders, validators, splitters, mergers, and remediation planners organize deployable batches.',
  },
  {
    title: 'Execution Services',
    body: 'State managers, Salesforce CLI integration, test planning, retry handling, and reports own runtime effects.',
  },
  {
    title: 'AI Boundary',
    body: 'Provider adapters for Agentforce and OpenAI can assist inference and validation while deterministic fallbacks remain available.',
  },
];

const risks = [
  'Circular metadata dependencies',
  'Unsupported parser shapes',
  'AI provider unavailability',
  'Partial wave failure',
  'Large org analysis cost',
];

const docs = [
  {
    title: 'Command Reference',
    body: 'Use analyze before deployment, validate the project state, then start or resume controlled deployment waves.',
    items: [
      'analyze builds graph and wave artifacts',
      'validate checks readiness and risk',
      'status and resume support long-running deployments',
    ],
  },
  {
    title: 'AI Configuration',
    body: 'AI assistance is optional. Provider adapters can help with dependency inference, priority weighting, and validation notes.',
    items: [
      'Supported providers: agentforce and openai',
      'Timeouts and models are explicit config',
      'Deterministic fallbacks remain available',
    ],
  },
  {
    title: 'Known Limitations',
    body: 'The tool is conservative around unsupported metadata shapes and partial failures. It should surface uncertainty before deployment.',
    items: [
      'Parser coverage depends on metadata type',
      'Cycle remediation is intentionally narrow',
      'AI unavailability should degrade gracefully',
    ],
  },
];

const diagramNodes = [
  { id: 'cli', label: 'Command Layer', x: 40, y: 90 },
  { id: 'scan', label: 'Metadata Scanners', x: 290, y: 30 },
  { id: 'graph', label: 'Dependency Graph', x: 290, y: 150 },
  { id: 'waves', label: 'Wave Engine', x: 540, y: 90 },
  { id: 'validate', label: 'Validation', x: 790, y: 30 },
  { id: 'execute', label: 'Execution Services', x: 790, y: 150 },
];

const diagramEdges = [
  ['cli', 'scan'],
  ['cli', 'graph'],
  ['scan', 'waves'],
  ['graph', 'waves'],
  ['waves', 'validate'],
  ['waves', 'execute'],
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/">
          Smart Deployment
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/architecture">Architecture</NavLink>
          <NavLink to="/docs">Docs</NavLink>
          <a href="https://jterrats.dev">Main site</a>
          <a href="https://github.com/jterrats/smart-deployment">GitHub</a>
        </nav>
      </header>
      {children}
    </div>
  );
}

function ArchitectureDiagram() {
  const [scale, setScale] = useState(1);
  const nodeMap = new Map(diagramNodes.map((node) => [node.id, node]));

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
              {diagramEdges.map(([from, to]) => {
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
              {diagramNodes.map((node) => (
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
  return (
    <Shell>
      <main>
        <section className="hero">
          <p className="eyebrow">Salesforce CLI Plugin</p>
          <h1>Dependency-aware deployment orchestration for Salesforce metadata.</h1>
          <p className="lead">
            Smart Deployment scans metadata, builds a dependency graph, generates staged deployment waves, validates
            project state, and supports optional AI-assisted prioritization and dependency inference.
          </p>
          <div className="actions">
            <Link className="button button-primary" to="/architecture">
              View Architecture
            </Link>
            <Link className="button button-secondary" to="/docs">
              Read Docs
            </Link>
          </div>
        </section>

        <section className="command-grid" aria-label="Primary command surface">
          {commands.map((item) => (
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
            <p className="eyebrow">Operating Model</p>
            <h2>Analyze first, deploy in controlled waves.</h2>
          </div>
          <div className="flow-diagram" aria-label="Deployment flow">
            <div>Scan</div>
            <div>Graph</div>
            <div>Plan Waves</div>
            <div>Validate</div>
            <div>Deploy</div>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Architecture() {
  return (
    <Shell>
      <main>
        <section className="page-header">
          <p className="eyebrow">Architecture</p>
          <h1>Layered deployment planning with explicit side-effect boundaries.</h1>
          <p className="lead">
            The plugin keeps parsing, analysis, wave planning, AI inference, and Salesforce CLI execution in separate
            modules so deployment risk is visible before remote changes begin.
          </p>
        </section>

        <section className="layer-stack" aria-label="Architecture layers">
          {layers.map((layer, index) => (
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
            <p className="eyebrow">System Diagram</p>
            <h2>Analysis stays separate from deployment execution.</h2>
            <p>
              The command layer coordinates local analysis first. Remote Salesforce effects only happen through the
              execution services after validation and wave planning.
            </p>
          </div>
          <ArchitectureDiagram />
        </section>

        <section className="diagram-section">
          <div>
            <p className="eyebrow">Deployment Flow</p>
            <h2>Analyze, validate, execute, then resume if needed.</h2>
            <p>
              Each phase has a durable artifact: graph output, deployment waves, validation findings, deployment state,
              and final reports.
            </p>
          </div>
          <div className="process-list" aria-label="Deployment process artifacts">
            <span>metadata scan</span>
            <span>dependency graph</span>
            <span>wave plan</span>
            <span>validation findings</span>
            <span>deployment state</span>
            <span>release report</span>
          </div>
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Resilience</p>
            <h2>Known risks are surfaced as product behavior.</h2>
          </div>
          <ul className="risk-list">
            {risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">AI Boundary</p>
            <h2>Optional inference does not replace deterministic analysis.</h2>
          </div>
          <div className="split-panel">
            <article>
              <h3>Deterministic Core</h3>
              <p>Parsers, graph algorithms, metadata scanners, and validators produce the baseline deployment plan.</p>
            </article>
            <article>
              <h3>Provider Adapters</h3>
              <p>Agentforce and OpenAI adapters add prioritization and inference behind explicit configuration.</p>
            </article>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Docs() {
  return (
    <Shell>
      <main>
        <section className="page-header">
          <p className="eyebrow">Documentation</p>
          <h1>Operate Smart Deployment from one place.</h1>
          <p className="lead">
            The public docs cover the command surface, AI configuration, known limits, and the architecture boundary
            that keeps analysis separate from deployment side effects.
          </p>
        </section>

        <section className="docs-grid" aria-label="Documentation sections">
          {docs.map((section) => (
            <article className="docs-card" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Next Step</p>
            <h2>Understand the layers before changing deployment behavior.</h2>
          </div>
          <div className="split-panel">
            <article>
              <h3>Architecture</h3>
              <p>Review command, analysis, wave, execution, and AI boundaries before extending the plugin.</p>
              <Link className="text-link" to="/architecture">
                View Architecture
              </Link>
            </article>
            <article>
              <h3>Source Docs</h3>
              <p>The historical Markdown docs remain in the repository for deeper implementation context.</p>
              <a className="text-link" href="https://github.com/jterrats/smart-deployment/tree/main/docs">
                Browse source docs
              </a>
            </article>
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
