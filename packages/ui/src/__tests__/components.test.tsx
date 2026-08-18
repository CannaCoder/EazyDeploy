import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Avatar,
  cn,
} from "../index.js";

describe("cn utility", () => {
  it("merges class names and resolves conflicting tailwind classes", () => {
    const result = cn("px-2 py-1", "px-4", { "bg-red-500": true, "bg-blue-500": false });
    expect(result).toContain("px-4");
    expect(result).toContain("py-1");
    expect(result).toContain("bg-red-500");
    expect(result).not.toContain("px-2");
  });
});

describe("Button component", () => {
  it("renders with correct text and default variant", () => {
    render(<Button>Deploy Now</Button>);
    const btn = screen.getByRole("button", { name: "Deploy Now" });
    expect(btn).toBeDefined();
    expect(btn.className).toContain("bg-primary");
  });

  it("applies secondary and destructive variants", () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("bg-destructive");

    rerender(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole("button").className).toContain("hover:bg-accent");
  });

  it("handles disabled state", () => {
    render(<Button disabled>Building...</Button>);
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.className).toContain("disabled:opacity-50");
  });
});

describe("Card component", () => {
  it("renders card with header and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Running healthy on port 3000</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText("Service Status")).toBeDefined();
    expect(screen.getByText("Running healthy on port 3000")).toBeDefined();
  });
});

describe("Badge component", () => {
  it("renders with success and warning variants", () => {
    const { rerender } = render(<Badge variant="success">Healthy</Badge>);
    expect(screen.getByText("Healthy").className).toContain("text-emerald-500");

    rerender(<Badge variant="warning">Checking</Badge>);
    expect(screen.getByText("Checking").className).toContain("text-amber-500");
  });
});

describe("Avatar component", () => {
  it("renders fallback text when no src is provided", () => {
    render(<Avatar fallback="SP" alt="Shipora User" />);
    expect(screen.getByText("SP")).toBeDefined();
  });
});
