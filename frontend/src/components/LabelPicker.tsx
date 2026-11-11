import { useState } from "react";

import { errorMessage } from "../api/client";
import { labelApi } from "../api/endpoints";
import type { Label, LabelColor } from "../api/types";
import { LABEL_COLORS, LABEL_META } from "../lib/meta";
import { CheckIcon, PlusIcon } from "./icons";
import { Alert, Button, cn, Input } from "./ui";

interface Props {
  organizationId: number;
  labels: Label[];
  selected: number[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
  onCreated: (label: Label) => void;
}

/** Toggle the organization's labels on a task, or create a new one inline. */
export function LabelPicker({ organizationId, labels, selected, disabled, onChange, onCreated }: Readonly<Props>) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("sky");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const label = await labelApi.create({ organization: organizationId, name: name.trim(), color });
      onCreated(label);
      onChange([...selected, label.id]);
      setName("");
      setCreating(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Labels</legend>
      <div className="flex flex-wrap gap-1.5">
        {labels.length === 0 && !creating && <span className="text-xs text-slate-400">No labels yet.</span>}
        {labels.map((label) => {
          const on = selected.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => toggle(label.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition disabled:cursor-not-allowed",
                on ? LABEL_META[label.color].chip : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {on ? <CheckIcon className="size-3" /> : <span className={cn("size-2 rounded-full", LABEL_META[label.color].swatch)} />}
              {label.name}
            </button>
          );
        })}
        {!disabled && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 ring-1 ring-inset ring-dashed ring-brand-200 hover:bg-brand-50"
          >
            <PlusIcon className="size-3" /> New label
          </button>
        )}
      </div>
      {creating && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          {error && <Alert>{error}</Alert>}
          <Input
            aria-label="New label name"
            placeholder="e.g. Bug, Design, Backend"
            maxLength={40}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Label color">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full ring-2 ring-offset-2 ring-offset-slate-50",
                  LABEL_META[c].swatch,
                  color === c ? "ring-brand-600" : "ring-transparent",
                )}
              />
            ))}
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={() => void create()}>
                Add label
              </Button>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
