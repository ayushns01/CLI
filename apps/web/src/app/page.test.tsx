import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page.js";
import RunsPage from "./runs/page.js";
import TracesPage from "./traces/page.js";
import RegistryPage from "./registry/page.js";
import MonitoringPage from "./monitoring/page.js";

describe("Home page", () => {
  it("renders ChainMind heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /chainmind/i })).toBeDefined();
  });

  it("renders navigation links to all 4 sections", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /runs/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /traces/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /registry/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /monitoring/i })).toBeDefined();
  });

  it("renders environment badge", () => {
    render(<HomePage env="testnet" />);
    expect(screen.getByTestId("env-badge").textContent).toBe("testnet");
  });
});

describe("Runs page", () => {
  it("renders Run History heading", () => {
    render(<RunsPage />);
    expect(screen.getByRole("heading", { name: /run history/i })).toBeDefined();
  });

  it("renders empty state when no runs", () => {
    render(<RunsPage />);
    expect(screen.getByText(/no runs recorded yet/i)).toBeDefined();
  });

  it("renders run rows with columns", () => {
    const runs = [
      {
        id: "abcdefgh1234",
        command: "deploy",
        status: "success",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:01:00Z",
      },
    ];
    render(<RunsPage runs={runs} />);
    expect(screen.getByText("abcdefgh")).toBeDefined();
    expect(screen.getByText("deploy")).toBeDefined();
    expect(screen.getByText("success")).toBeDefined();
  });
});

describe("Traces page", () => {
  it("renders Debug Traces heading", () => {
    render(<TracesPage />);
    expect(screen.getByRole("heading", { name: /debug traces/i })).toBeDefined();
  });

  it("renders empty state when no traces", () => {
    render(<TracesPage />);
    expect(screen.getByText(/no debug traces recorded yet/i)).toBeDefined();
  });
});

describe("Registry page", () => {
  it("renders Contract Registry heading", () => {
    render(<RegistryPage />);
    expect(screen.getByRole("heading", { name: /contract registry/i })).toBeDefined();
  });

  it("renders empty state when no contracts", () => {
    render(<RegistryPage />);
    expect(screen.getByText(/no contracts deployed yet/i)).toBeDefined();
  });
});

describe("Monitoring page", () => {
  it("renders Monitoring heading", () => {
    render(<MonitoringPage />);
    expect(screen.getByRole("heading", { name: /monitoring/i })).toBeDefined();
  });

  it("renders empty state when no alerts", () => {
    render(<MonitoringPage />);
    expect(screen.getByText(/no monitoring alerts yet/i)).toBeDefined();
  });
});
