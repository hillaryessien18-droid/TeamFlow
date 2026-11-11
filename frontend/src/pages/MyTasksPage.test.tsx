import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { taskApi } from "../api/endpoints";
import { makeTask } from "../test/fixtures";
import { MyTasksPage } from "./MyTasksPage";

vi.mock("../api/endpoints", () => ({
  taskApi: { list: vi.fn(), update: vi.fn() },
}));

vi.mock("../context/OrgContext", () => ({
  useOrg: () => ({ current: { id: 7, name: "Acme" } }),
}));

const mocked = vi.mocked(taskApi);

function renderPage() {
  render(
    <MemoryRouter>
      <MyTasksPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("groups my open tasks by deadline and hides completed ones until expanded", async () => {
  mocked.list.mockResolvedValue([
    makeTask({ title: "Late report", due_date: "2020-01-01", is_overdue: true }),
    makeTask({ title: "Someday", due_date: "2099-01-01" }),
    makeTask({ title: "Whenever", due_date: null }),
    makeTask({ title: "Shipped", status: "completed", completed_at: "2026-11-01T10:00:00Z" }),
  ]);
  renderPage();

  expect(await screen.findByText("Late report")).toBeInTheDocument();
  expect(mocked.list).toHaveBeenCalledWith({ organization: 7, assignee: "me" });
  expect(screen.getByText("3 open tasks assigned to you in Acme.")).toBeInTheDocument();

  const overdue = screen.getByRole("heading", { name: /Overdue/ }).closest("section")!;
  expect(within(overdue).getByText("Late report")).toBeInTheDocument();
  const later = screen.getByRole("heading", { name: /Later/ }).closest("section")!;
  expect(within(later).getByText("Someday")).toBeInTheDocument();
  const noDeadline = screen.getByRole("heading", { name: /No deadline/ }).closest("section")!;
  expect(within(noDeadline).getByText("Whenever")).toBeInTheDocument();

  expect(screen.queryByText("Shipped")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Completed/ }));
  expect(screen.getByText("Shipped")).toBeInTheDocument();
});

test("ticking a task marks it as done", async () => {
  const task = makeTask({ title: "Write tests" });
  mocked.list.mockResolvedValue([task]);
  mocked.update.mockResolvedValue({ ...task, status: "completed" });
  renderPage();

  await userEvent.click(await screen.findByRole("button", { name: 'Mark "Write tests" as done' }));

  expect(mocked.update).toHaveBeenCalledWith(task.id, { status: "completed" });
});

test("links each task to its board", async () => {
  mocked.list.mockResolvedValue([makeTask({ id: 42, project: 3, title: "Open me" })]);
  renderPage();

  expect((await screen.findByText("Open me")).closest("a")).toHaveAttribute("href", "/projects/3?task=42");
});
