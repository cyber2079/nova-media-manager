import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

let nextId = 0;

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      // Trigger exit animation first
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, exiting: true } : i));
      // Then remove from DOM after animation completes
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 250);
    }, 2250);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-2xl animate-in slide-in-from-right-4 fade-in duration-200 border backdrop-blur-md",
              item.exiting && "animate-out slide-out-to-right-4 fade-out duration-200",
              item.type === "success" && "bg-[#0d2818]/95 border-green-500/30 text-green-300",
              item.type === "error" && "bg-[#2d0f0f]/95 border-red-500/30 text-red-300",
              item.type === "info" && "bg-surface-light/95 border-primary text-white"
            )}
          >
            {item.type === "success" && <Check className="h-4 w-4 text-green-400 shrink-0" />}
            {item.type === "error" && <X className="h-4 w-4 text-red-400 shrink-0" />}
            {item.type === "info" && <Info className="h-4 w-4 text-primary-light shrink-0" />}
            <span className="flex-1">{item.message}</span>
            <button onClick={() => remove(item.id)} className="text-current opacity-50 hover:opacity-100 shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
