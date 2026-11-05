import { makeTask } from "../test/fixtures";
import { dropPosition, groupByStatus, moveTask } from "./board";

const a = makeTask({ id: 1, status: "todo", position: 0 });
const b = makeTask({ id: 2, status: "todo", position: 1 });
const c = makeTask({ id: 3, status: "todo", position: 2 });
const d = makeTask({ id: 4, status: "in_progress", position: 0 });
const tasks = [c, d, a, b];

const ids = (list: { id: number }[]) => list.map((t) => t.id);

describe("groupByStatus", () => {
  it("splits tasks into columns ordered by position", () => {
    const columns = groupByStatus(tasks);
    expect(ids(columns.todo)).toEqual([1, 2, 3]);
    expect(ids(columns.in_progress)).toEqual([4]);
    expect(columns.completed).toEqual([]);
  });
});

describe("moveTask", () => {
  it("moves a task to another column and renumbers both", () => {
    const columns = groupByStatus(moveTask(tasks, 1, "in_progress", 0));
    expect(ids(columns.todo)).toEqual([2, 3]);
    expect(columns.todo.map((t) => t.position)).toEqual([0, 1]);
    expect(ids(columns.in_progress)).toEqual([1, 4]);
    expect(columns.in_progress[0].status).toBe("in_progress");
  });

  it("reorders within a column and clamps out-of-range positions", () => {
    expect(ids(groupByStatus(moveTask(tasks, 1, "todo", 99)).todo)).toEqual([2, 3, 1]);
  });

  it("returns the list unchanged for an unknown task", () => {
    expect(moveTask(tasks, 999, "completed", 0)).toBe(tasks);
  });
});

describe("dropPosition", () => {
  it("is the index of the card dropped in front of, ignoring the dragged card", () => {
    expect(dropPosition(tasks, 1, "todo", 3)).toBe(1);
    expect(dropPosition(tasks, 4, "todo", 2)).toBe(1);
  });

  it("is the end of the column when dropped on empty space", () => {
    expect(dropPosition(tasks, 4, "todo", null)).toBe(3);
    expect(dropPosition(tasks, 1, "completed", null)).toBe(0);
  });
});
