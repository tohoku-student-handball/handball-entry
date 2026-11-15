"use client";
import { useState, type ReactNode } from "react";

/** 押すと画面内に「本当に〜しますか？」を出す2段階のボタン（ブラウザの確認ダイアログを使わない） */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className = "btn link danger",
}: {
  label: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="confirm-box" role="alertdialog">
      <span>{question}</span>
      <span className="row">
        <button type="button" className="btn danger-fill" onClick={async () => { await onConfirm(); setAsking(false); }}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={() => setAsking(false)}>
          やめる
        </button>
      </span>
    </span>
  );
}
