"use client";

import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "@/components/icons";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const fieldControlClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

export function FormSubheading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
      {children}
    </p>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  required,
  autoComplete,
  minLength,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm text-muted" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldControlClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-accent"
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        >
          {visible ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="text-muted">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 ${fieldControlClass}`}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="text-muted">{label}</span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 resize-none ${fieldControlClass}`}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; separatorBefore?: boolean }[];
}) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [scrollThumb, setScrollThumb] = useState({
    visible: false,
    height: 0,
    top: 0,
  });
  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const updateScrollThumb = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const { scrollTop, scrollHeight, clientHeight } = list;
    if (scrollHeight <= clientHeight + 1) {
      setScrollThumb({ visible: false, height: 0, top: 0 });
      return;
    }

    const inset = 8;
    const trackHeight = clientHeight - inset * 2;
    const thumbHeight = Math.max(32, (clientHeight / scrollHeight) * trackHeight);
    const maxTop = Math.max(0, trackHeight - thumbHeight);
    const top =
      maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;

    setScrollThumb({ visible: true, height: thumbHeight, top });
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    updateMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    const frame = requestAnimationFrame(updateScrollThumb);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
      cancelAnimationFrame(frame);
    };
  }, [open, updateMenuPosition, updateScrollThumb]);

  useEffect(() => {
    if (!open) return;
    updateScrollThumb();
  }, [open, options, updateScrollThumb]);

  return (
    <div ref={rootRef} className="relative block text-sm">
      <span id={`${id}-label`} className="text-muted">
        {label}
      </span>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`mt-1 flex items-center justify-between gap-3 text-left ${fieldControlClass}`}
      >
        <span className="truncate">{selected?.label ?? "Seç"}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="fixed z-[100] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_12px_28px_rgba(194,24,91,0.12)]"
            >
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-labelledby={`${id}-label`}
                onScroll={updateScrollThumb}
                className="hide-scrollbar max-h-56 overflow-y-auto overscroll-contain p-1"
              >
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <li key={option.value} role="option" aria-selected={active}>
                      {option.separatorBefore ? (
                        <div
                          className="mx-1 my-1 border-t border-border/80"
                          aria-hidden="true"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={`w-full rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                          active
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-foreground hover:bg-surface-muted/80"
                        }`}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {scrollThumb.visible ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-2 right-1.5 w-1.5 rounded-full bg-accent-soft/80"
                >
                  <div
                    className="absolute w-full rounded-full bg-accent"
                    style={{
                      height: scrollThumb.height,
                      top: scrollThumb.top,
                    }}
                  />
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
