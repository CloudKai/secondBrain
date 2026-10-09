import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function EvidenceDialog({ children, origin, onClose }: {
  children: ReactNode;
  origin?: HTMLElement | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [origin]);

  return <dialog ref={dialogRef} className="modal evidence-dialog"
    aria-labelledby={titleId} onCancel={onClose}
    onClick={event => { if (event.target === dialogRef.current) onClose(); }}>
    <header className="evidence-dialog-header">
      <h2 id={titleId}>Inspect evidence</h2>
      <button autoFocus className="icon-button" aria-label="Close evidence and return to reading" onClick={onClose}>
        <X size={20} />
      </button>
    </header>
    <div className="evidence-dialog-content">{children}</div>
  </dialog>;
}
