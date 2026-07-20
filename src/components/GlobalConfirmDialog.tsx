import ConfirmDialog from "@/components/ConfirmDialog";
import { useConfirmStore } from "@/stores/confirmStore";

export default function GlobalConfirmDialog() {
  const msg = useConfirmStore((s) => s.msg);
  const onOk = useConfirmStore((s) => s.onOk);
  const close = useConfirmStore((s) => s.close);
  if (!onOk) return null;
  return (
    <ConfirmDialog
      open
      message={msg}
      onConfirm={() => { onOk(); close(); }}
      onCancel={close}
    />
  );
}
