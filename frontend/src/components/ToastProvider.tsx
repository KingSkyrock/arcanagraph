"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastOptions = {
  message: string;
  type?: ToastType;
  duration?: number;
};

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLES: Record<ToastType, React.CSSProperties> = {
  success: { background: "rgba(34, 197, 94, 0.95)", color: "#fff" },
  error: { background: "rgba(239, 68, 68, 0.95)", color: "#fff" },
  info: { background: "rgba(11, 31, 92, 0.95)", color: "#fff" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const toast = useCallback((options: ToastOptions) => {
    const id = String(++counterRef.current);
    const entry: Toast = {
      id,
      message: options.message,
      type: options.type ?? "info",
    };

    setToasts((prev) => [...prev, entry]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options.duration ?? 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 90,
          right: 20,
          zIndex: "var(--z-alert)" as unknown as number,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
          maxWidth: 360,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              ...TYPE_STYLES[t.type],
              padding: "12px 18px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              pointerEvents: "auto",
              animation: "toast-in 0.25s ease-out",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
