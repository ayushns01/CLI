export interface HomeProps {
  env?: string;
  lastUpdated?: string;
}

export default function HomePage({ env = "local", lastUpdated }: HomeProps) {
  return (
    <div>
      <h1>ChainMind</h1>
      <span data-testid="env-badge">{env}</span>
      {lastUpdated && <span data-testid="last-updated">{lastUpdated}</span>}
      <nav aria-label="sections">
        <a href="/runs">Runs</a>
        <a href="/traces">Traces</a>
        <a href="/registry">Registry</a>
        <a href="/monitoring">Monitoring</a>
      </nav>
    </div>
  );
}
