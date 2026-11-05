import { AxiosError, AxiosHeaders } from "axios";

import { errorMessage } from "../api/client";
import { initials, parseDate, relativeTime } from "./format";

describe("format helpers", () => {
  it("parses date-only strings as local dates", () => {
    const date = parseDate("2026-03-09");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 9]);
  });

  it("builds initials from first and last names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Grace Brewster Hopper")).toBe("GH");
    expect(initials("cher")).toBe("C");
    expect(initials("  ")).toBe("?");
  });

  it("describes how long ago something happened", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(relativeTime("2026-11-05T11:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-11-05T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-11-05T07:00:00Z", now)).toBe("5h ago");
    expect(relativeTime("2026-11-03T12:00:00Z", now)).toBe("2d ago");
  });
});

function apiError(status: number, data: unknown) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe("errorMessage", () => {
  it("uses the DRF detail message", () => {
    expect(errorMessage(apiError(403, { detail: "Not allowed." }))).toBe("Not allowed.");
  });

  it("labels field errors", () => {
    expect(errorMessage(apiError(400, { email: ["Already taken."], non_field_errors: ["Bad."] }))).toBe(
      "Email: Already taken. Bad.",
    );
  });

  it("explains network failures", () => {
    expect(errorMessage(new AxiosError("Network Error", "ERR_NETWORK"))).toMatch(/can't reach the server/i);
  });

  it("falls back for unknown errors", () => {
    expect(errorMessage("weird", "Fallback")).toBe("Fallback");
  });
});
