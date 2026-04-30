import type { ReactNode } from "react";

export const metadata = { title: "ChainMind" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/">Overview</a>
          <a href="/runs">Runs</a>
          <a href="/traces">Traces</a>
          <a href="/registry">Registry</a>
          <a href="/monitoring">Monitoring</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
