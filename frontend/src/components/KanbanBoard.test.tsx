import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { alice, makeTask } from "../test/fixtures";
import { KanbanBoard } from "./KanbanBoard";

const tasks = [
  makeTask({ id: 1, title: "Write spec", status: "todo", position: 0, priority: "high" }),
  makeTask({ id: 2, title: "Build API", status: "todo", position: 1, assignee: 1, assignee_detail: alice }),
  makeTask({ id: 3, title: "Design logo", status: "in_progress", position: 0, due_date: "2020-01-01", is_overdue: true }),
  makeTask({ id: 4, title: "Kickoff", status: "completed", position: 0, comment_count: 2 }),
];

function setup(props: Partial<Parameters<typeof KanbanBoard>[0]> = {}) {
  const handlers = { onMove: vi.fn(), onOpen: vi.fn(), onAdd: vi.fn() };
  render(<KanbanBoard tasks={tasks} {...handlers} {...props} />);
  return handlers;
}

const column = (name: string) => screen.getByRole("region", { name: `${name} column` });

describe("KanbanBoard", () => {
  it("renders the three columns with their tasks in order", () => {
    setup();
    const todo = within(column("To Do"));
    expect(todo.getAllByRole("button", { name: /write spec|build api/i }).map((el) => el.textContent)).toEqual([
      expect.stringContaining("Write spec"),
      expect.stringContaining("Build API"),
    ]);
    expect(within(column("In Progress")).getByText("Design logo")).toBeInTheDocument();
    expect(within(column("Completed")).getByText("Kickoff")).toBeInTheDocument();
    expect(within(column("Completed")).getByLabelText("2 comments")).toBeInTheDocument();
    expect(within(column("In Progress")).getByText("(overdue)")).toBeInTheDocument();
  });

  it("opens a task when its card is clicked or activated with the keyboard", async () => {
    const { onOpen } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Build API" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));

    screen.getByRole("button", { name: "Kickoff" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 4 }));
  });

  it("moves a card to the end of another column when dropped on empty space", () => {
    const { onMove } = setup();
    fireEvent.dragStart(screen.getByRole("button", { name: "Write spec" }));
    fireEvent.dragOver(column("Completed"));
    fireEvent.drop(column("Completed"));
    expect(onMove).toHaveBeenCalledWith(1, "completed", null);
  });

  it("drops a card in front of the card it is released over", () => {
    const { onMove } = setup();
    fireEvent.dragStart(screen.getByRole("button", { name: "Design logo" }));
    const target = screen.getByRole("button", { name: "Build API" });
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    expect(onMove).toHaveBeenCalledWith(3, "todo", 2);
  });

  it("is read-only for archived projects", () => {
    const { onMove } = setup({ readOnly: true });
    expect(screen.getByRole("button", { name: "Write spec" })).toHaveAttribute("draggable", "false");
    expect(screen.queryByRole("button", { name: /add task/i })).not.toBeInTheDocument();
    fireEvent.drop(column("Completed"));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("offers an add button per column", async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add task to In Progress" }));
    expect(onAdd).toHaveBeenCalledWith("in_progress");
  });
});
