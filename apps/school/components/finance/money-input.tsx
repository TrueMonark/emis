"use client";

import { useState } from "react";
import { Input } from "@school/ui/components/input";
import { parseKwacha } from "@school/shared/fees/money";

/**
 * Kwacha amount box: the person types "1,250.50" or "1250"; the value is whole ngwee
 * (null while it isn't a valid amount).
 */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0.00",
  disabled,
}: {
  value: number | null;
  onChange: (ngwee: number | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value != null ? (value / 100).toFixed(2) : "");
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // Follow a value set from outside (e.g. "pay the balance").
    setSeen(value);
    if (value !== (text.trim() ? parseKwacha(text) : null)) setText(value != null ? (value / 100).toFixed(2) : "");
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">K</span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-7"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() ? parseKwacha(e.target.value) : null);
        }}
      />
    </div>
  );
}
