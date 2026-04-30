import type { RunRow } from "../../lib/store.ts";

export interface RunsPageProps {
  runs?: RunRow[];
}

export default function RunsPage({ runs = [] }: RunsPageProps) {
  return (
    <div>
      <h1>Run History</h1>
      {runs.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Command</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.id.slice(0, 8)}</td>
                <td>{r.command}</td>
                <td>{r.status}</td>
                <td>{r.startedAt}</td>
                <td>{r.finishedAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
