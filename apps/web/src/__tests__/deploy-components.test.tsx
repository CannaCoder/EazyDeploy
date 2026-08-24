import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DeployStatusBadge } from "../components/deploy/deploy-status-badge.js";
import { DeployProgressStepper } from "../components/deploy/deploy-progress-stepper.js";

describe("DeployStatusBadge Component", () => {
  it("renders success variant with 'Live & Healthy'", () => {
    render(<DeployStatusBadge status="success" />);
    expect(screen.getByText("Live & Healthy")).toBeDefined();
  });

  it("renders building variant with 'Building Containers'", () => {
    render(<DeployStatusBadge status="building" />);
    expect(screen.getByText("Building Containers")).toBeDefined();
  });

  it("renders failed variant with 'Deploy Failed'", () => {
    render(<DeployStatusBadge status="failed" />);
    expect(screen.getByText("Deploy Failed")).toBeDefined();
  });

  it("renders rolled_back variant with 'Rolled Back'", () => {
    render(<DeployStatusBadge status="rolled_back" />);
    expect(screen.getByText("Rolled Back")).toBeDefined();
  });
});

describe("DeployProgressStepper Component", () => {
  it("renders all 6 pipeline stages and active progress", () => {
    render(
      <DeployProgressStepper
        stage="building"
        percent={30}
        currentStep="Building Docker container images in parallel"
        services={[
          {
            name: "web",
            type: "nextjs",
            port: 3000,
            stage: "building",
          },
          {
            name: "api",
            type: "node",
            port: 4000,
            stage: "building",
          },
        ]}
      />
    );

    expect(screen.getByText("Service Discovery")).toBeDefined();
    expect(screen.getByText("CodeBuild Docker Builds")).toBeDefined();
    expect(screen.getByText("Secret Slicing")).toBeDefined();
    expect(screen.getByText("ECS Fargate Provisioning")).toBeDefined();
    expect(screen.getByText("ALB Subdomain Routing")).toBeDefined();
    expect(screen.getByText("Live & Deployed")).toBeDefined();
    expect(screen.getByText("30%")).toBeDefined();
    expect(screen.getByText("Building Docker container images in parallel")).toBeDefined();
  });

  it("renders live service endpoints on completion", () => {
    render(
      <DeployProgressStepper
        stage="completed"
        percent={100}
        currentStep="Deployment completed successfully"
        services={[
          {
            name: "web",
            type: "nextjs",
            port: 3000,
            stage: "success",
            serviceUrl: "https://web-myapp.shipora.app",
          },
        ]}
        deployedUrls={{
          web: "https://web-myapp.shipora.app",
        }}
      />
    );

    expect(screen.getByText("Deployment Complete")).toBeDefined();
    expect(screen.getByText("100%")).toBeDefined();
    expect(screen.getByText("https://web-myapp.shipora.app")).toBeDefined();
  });

  it("renders failure message when deployment fails", () => {
    render(
      <DeployProgressStepper
        stage="failed"
        percent={100}
        currentStep="Container build failed for: web"
        error="Container build failed: Dockerfile syntax error at line 14"
      />
    );

    expect(screen.getByText("Deployment Failed")).toBeDefined();
    expect(screen.getByText("Failure Details")).toBeDefined();
    expect(
      screen.getByText("Container build failed: Dockerfile syntax error at line 14")
    ).toBeDefined();
  });

  it("renders Azure provider specific stages in stepper", () => {
    render(
      <DeployProgressStepper
        stage="building"
        percent={30}
        provider="azure"
        services={[{ name: "web", type: "nextjs", port: 3000 }]}
      />
    );

    expect(screen.getByText("ACR Container Builds")).toBeDefined();
    expect(screen.getByText("Container Apps Provisioning")).toBeDefined();
    expect(screen.getByText("HTTPS Ingress Routing")).toBeDefined();
  });
});

