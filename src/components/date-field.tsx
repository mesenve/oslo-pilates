"use client";

import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { fieldControlClass } from "@/components/form-fields";
import {
  formatInputDate,
  monthGrid,
  monthTitle,
  parseISODate,
  todayISO,
} from "@/lib/dates";
import { CALENDAR_HEADERS } from "@/lib/labels";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <div className="relative block text-sm">
        <span id={`${id}-label`} className="text-muted">
          {label}
        </span>
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen(true)}
          className={`mt-1 flex w-full items-center justify-between gap-3 text-left ${fieldControlClass}`}
        >
          <span className="truncate capitalize">
            {value ? formatInputDate(value) : "Tarih seç"}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted">
            <CalendarIcon className="h-4 w-4" />
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        </button>
      </div>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
              <button
                type="button"
                aria-label="Kapat"
                onClick={close}
                className="absolute inset-0 bg-[#2b1a22]/35 backdrop-blur-[2px]"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className="relative z-10 w-full max-w-sm rounded-3xl border border-white/80 bg-white p-5 shadow-[0_18px_40px_rgba(194,24,91,0.18)]"
              >
                <DatePickerPanel
                  value={value}
                  onSelect={(iso) => {
                    onChange(iso);
                    close();
                  }}
                />
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                  {!required ? (
                    <button
                      type="button"
                      onClick={() => {
                        onChange("");
                        close();
                      }}
                      className="text-sm text-muted hover:text-foreground"
                    >
                      Temizle
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(todayISO());
                      close();
                    }}
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    Bugün
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function DatePickerPanel({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (iso: string) => void;
}) {
  const today = todayISO();
  const initial = value || today;
  const start = parseISODate(`${initial.slice(0, 7)}-01`);
  const [cursor, setCursor] = useState({
    year: start.getFullYear(),
    month: start.getMonth(),
  });

  useEffect(() => {
    if (!value) return;
    const date = parseISODate(value);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }, [value]);

  const cells = monthGrid(cursor.year, cursor.month);

  function shift(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-full p-2 text-accent hover:bg-accent-soft"
          aria-label="Önceki ay"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <p className="font-serif text-lg capitalize">
          {monthTitle(cursor.year, cursor.month)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-full p-2 text-accent hover:bg-accent-soft"
          aria-label="Sonraki ay"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {CALENDAR_HEADERS.map((header) => (
          <div key={header} className="py-1">
            {header}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, index) => {
          if (!iso) return <div key={`empty-${index}`} className="h-10" />;
          const selected = value === iso;
          const isToday = iso === today;
          const day = Number(iso.slice(8));

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`relative flex h-10 items-center justify-center rounded-2xl text-sm transition-colors ${
                selected
                  ? "bg-gradient-to-br from-[#f06292] to-accent text-white shadow-md"
                  : isToday
                    ? "bg-accent-soft text-accent"
                    : "bg-white/80 text-foreground hover:bg-surface-muted"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
