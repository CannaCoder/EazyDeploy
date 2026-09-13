import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CloudProviderCard } from "../components/cloud-connect/cloud-provider-card.js";
import { AzureConnectWizard } from "../components/cloud-connect/azure-connect-wizard.js";
import { SmartEnvForm } from "../components/deploy/smart-env-form.js";

describe("CloudProviderCard Component", () => {
  it("renders AWS provider card correctly", () => {
    render(
      <CloudProviderCard
        provider="aws"
        title="Amazon Web Services"
        description="ECS Fargate & CodeBuild"
        badge="Supported"
        isConnected={true}
      />
    );

    expect(screen.getByText("Amazon Web Services")).toBeDefined();
    expect(screen.getByText("ECS Fargate & CodeBuild")).toBeDefined();
    expect(screen.getByText("Connected")).toBeDefined();
  });

  it("renders disabled state for Phase 6 providers", () => {
    render(
      <CloudProviderCard
        provider="digitalocean"
        title="DigitalOcean"
        description="App Platform"
        disabled={true}
      />
    );

    expect(screen.getByText("DigitalOcean")).toBeDefined();
    expect(screen.getByText("Coming Soon")).toBeDefined();
  });

  it("renders selected state and triggers onSelect callback on click", () => {
    const handleSelect = vi.fn();
    render(
      <CloudProviderCard
        provider="azure"
        title="Microsoft Azure"
        description="Container Apps • ACR • Key Vault"
        badge="1-Click SSO"
        isConnected={true}
        isSelected={true}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText("Microsoft Azure")).toBeDefined();
    expect(screen.getByText("1-Click SSO")).toBeDefined();
    expect(screen.getByText("Connected")).toBeDefined();

    const card = screen.getByText("Microsoft Azure").closest("div");
    if (card) fireEvent.click(card);
    expect(handleSelect).toHaveBeenCalledWith("azure");
  });

  it("renders GCP provider card with Connect button when disconnected", () => {
    const handleConnect = vi.fn();
    render(
      <CloudProviderCard
        provider="gcp"
        title="Google Cloud"
        description="Cloud Run • Artifact Reg • Secrets"
        badge="1-Click OAuth"
        isConnected={false}
        onConnect={handleConnect}
      />
    );

    expect(screen.getByText("Google Cloud")).toBeDefined();
    expect(screen.getByText("Not connected")).toBeDefined();
    const connectBtn = screen.getByText("Connect");
    expect(connectBtn).toBeDefined();
    fireEvent.click(connectBtn);
    expect(handleConnect).toHaveBeenCalledWith("gcp");
  });
});

describe("AzureConnectWizard Component (1-Click Microsoft SSO)", () => {
  it("renders 1-Click Microsoft Azure button and value props", () => {
    render(<AzureConnectWizard />);

    expect(screen.getByText("Connect Microsoft Azure")).toBeDefined();
    expect(screen.getByText("1-Click SSO")).toBeDefined();
    expect(screen.getByText("Sign in with Microsoft Azure")).toBeDefined();
    expect(screen.getByText("Least-Privilege Scoped Access")).toBeDefined();
  });

  it("calls /auth/azure/start and redirects to Microsoft OAuth URL on click", async () => {
    const mockAuthUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test";

    // Mock fetch to return a real-looking OAuth URL
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, authUrl: mockAuthUrl }),
    } as Response);

    // Mock window.location.href assignment
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    render(<AzureConnectWizard />);

    const signInBtn = screen.getByText("Sign in with Microsoft Azure");
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/azure/start")
      );
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(window.location.href).toBe(mockAuthUrl);
    }, { timeout: 3000 });

    // Restore
    Object.defineProperty(window, "location", { writable: true, value: originalLocation });
  });

  it("shows error when /auth/azure/start API fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    render(<AzureConnectWizard />);

    const signInBtn = screen.getByText("Sign in with Microsoft Azure");
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(screen.getByText(/Failed to start Azure OAuth flow/i)).toBeDefined();
    }, { timeout: 3000 });
  });
});

describe("SmartEnvForm Component", () => {
  it("renders categorized entries with descriptions and requirement badges", () => {
    const entries = [
      {
        key: "DATABASE_URL",
        defaultValue: "postgresql://localhost:5432/db",
        description: "Postgres connection string",
        group: "Database",
        isRequired: false,
      },
      {
        key: "API_SECRET_KEY",
        defaultValue: null,
        description: "Secret for signing requests",
        group: "Security",
        isRequired: true,
      },
    ];

    render(<SmartEnvForm entries={entries} />);

    expect(screen.getByText("DATABASE_URL")).toBeDefined();
    expect(screen.getByText("API_SECRET_KEY")).toBeDefined();
    expect(screen.getByText("Required")).toBeDefined();
    expect(screen.getByText("Optional")).toBeDefined();
    expect(screen.getByText("Database")).toBeDefined();
    expect(screen.getByText("Security")).toBeDefined();
  });

  it("allows submitting form with updated values", () => {
    const handleSave = vi.fn();
    const entries = [
      {
        key: "PORT",
        defaultValue: "3000",
        description: "HTTP Port",
        group: "Server",
        isRequired: false,
      },
    ];

    render(<SmartEnvForm entries={entries} onSave={handleSave} />);

    const submitBtn = screen.getByText("Save & Sync Secrets");
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(expect.objectContaining({ PORT: "3000" }));
  });
});

