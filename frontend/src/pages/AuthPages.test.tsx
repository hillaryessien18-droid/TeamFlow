import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { authApi } from "../api/endpoints";
import { RequireAuth } from "../components/RouteGuards";
import { AuthProvider } from "../context/AuthContext";
import { alice } from "../test/fixtures";
import { LoginPage } from "./LoginPage";
import { ResetPasswordPage } from "./PasswordResetPages";
import { RegisterPage } from "./RegisterPage";

vi.mock("../api/endpoints", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    confirmPasswordReset: vi.fn(),
  },
}));

const mocked = vi.mocked(authApi);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>Dashboard home</p>} />
            <Route path="/projects" element={<p>Projects list</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function badRequest(data: unknown) {
  return new AxiosError("Bad", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 401,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("authentication flow", () => {
  it("redirects anonymous users to the login page", () => {
    renderAt("/projects");
    expect(screen.getByRole("heading", { name: "Log in to TeamFlow" })).toBeInTheDocument();
    expect(screen.queryByText("Projects list")).not.toBeInTheDocument();
  });

  it("logs in, stores the tokens and returns to the requested page", async () => {
    mocked.login.mockResolvedValue({ access: "a-token", refresh: "r-token", user: alice });
    renderAt("/projects");

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3cure-pass!");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Projects list")).toBeInTheDocument();
    expect(mocked.login).toHaveBeenCalledWith("alice@example.com", "S3cure-pass!");
    expect(localStorage.getItem("teamflow.access")).toBe("a-token");
    expect(localStorage.getItem("teamflow.refresh")).toBe("r-token");
  });

  it("shows the server's error when login fails", async () => {
    mocked.login.mockRejectedValue(badRequest({ detail: "No active account found with the given credentials" }));
    renderAt("/login");

    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No active account found");
    expect(localStorage.getItem("teamflow.access")).toBeNull();
  });

  it("restores the session from stored tokens", async () => {
    localStorage.setItem("teamflow.access", "a");
    localStorage.setItem("teamflow.refresh", "r");
    mocked.me.mockResolvedValue(alice);
    renderAt("/");
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  it("rejects mismatched passwords without calling the API", async () => {
    renderAt("/register");
    await userEvent.type(screen.getByLabelText("Full name"), "Alice Smith");
    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3cure-pass!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different-pass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords don't match.");
    expect(mocked.register).not.toHaveBeenCalled();
  });

  it("creates the account and signs the user in", async () => {
    mocked.register.mockResolvedValue({ access: "a", refresh: "r", user: alice });
    renderAt("/register");
    await userEvent.type(screen.getByLabelText("Full name"), "Alice Smith");
    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "S3cure-pass!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "S3cure-pass!");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(mocked.register).toHaveBeenCalledWith({
      full_name: "Alice Smith",
      email: "alice@example.com",
      password: "S3cure-pass!",
    });
  });
});

describe("ResetPasswordPage", () => {
  it("submits the uid and token from the emailed link", async () => {
    mocked.confirmPasswordReset.mockResolvedValue({ detail: "Your password has been reset." });
    renderAt("/reset-password?uid=MQ&token=abc-123");
    await userEvent.type(screen.getByLabelText("New password"), "N3w-password!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "N3w-password!");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been reset.");
    expect(mocked.confirmPasswordReset).toHaveBeenCalledWith("MQ", "abc-123", "N3w-password!");
  });

  it("explains when the link is incomplete", () => {
    renderAt("/reset-password");
    expect(screen.getByRole("heading", { name: "Invalid reset link" })).toBeInTheDocument();
  });
});
