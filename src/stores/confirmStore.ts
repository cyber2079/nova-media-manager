import { create } from "zustand";

interface ConfirmState {
  msg: string;
  onOk: (() => void) | null;
  confirm: (msg: string, onOk: () => void) => void;
  close: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  msg: "",
  onOk: null,
  confirm: (msg, onOk) => set({ msg, onOk }),
  close: () => set({ msg: "", onOk: null }),
}));
