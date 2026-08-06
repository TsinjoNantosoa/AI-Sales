import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RoleGuard } from "@/routes/guards/RoleGuard";
import { useAuthStore } from "@/stores/authStore";

function Protected() {
  return <div>Protected Content</div>;
}

describe("RoleGuard", () => {
  it("allows ADMIN to access admin routes", () => {
    useAuthStore.setState({
      user: {
        id: "u1",
        email: "admin@aisales.demo",
        firstName: "Alex",
        lastName: "Carter",
        role: "ADMIN",
        timezone: "UTC",
        language: "en",
      },
      token: "t",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RoleGuard allowedRoles={["ADMIN"]}>
                <Protected />
              </RoleGuard>
            }
          />
          <Route path="/app/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects SALES_REPRESENTATIVE away from admin pages", () => {
    useAuthStore.setState({
      user: {
        id: "u3",
        email: "sales@aisales.demo",
        firstName: "Mike",
        lastName: "Torres",
        role: "SALES_REPRESENTATIVE",
        timezone: "UTC",
        language: "en",
      },
      token: "t",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RoleGuard allowedRoles={["ADMIN"]}>
                <Protected />
              </RoleGuard>
            }
          />
          <Route path="/app/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
