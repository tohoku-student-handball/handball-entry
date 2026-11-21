"use client";
import { useState, type ReactNode } from "react";
import { toMessage } from "@/lib/store";
import { GENDER_LABEL, TEAM_STATUS_LABEL, type Member, type Team, type TeamStatus } from "@/lib/types";
import type { Issue } from "@/lib/validation";

/** 押すと非同期の処理を行い、処理中・エラーを表示するボタン */
export function ActionButton({
  onClick,
  children,
  className = "btn primary",
  busyLabel = "処理中…",
  disabled,
  type = "button",
}: {
  onClick: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  busyLabel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="action">
      <button
        type={type}
        className={className}
        disabled={busy || disabled}
        onClick={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onClick();
          } catch (err) {
            setError(toMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : children}
      </button>
      {error && (
        <span className="msg-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ status }: { status: TeamStatus }) {
  return <span className={`badge status-${status}`}>{TEAM_STATUS_LABEL[status]}</span>;
}

export function LockBanner({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p className="lock-banner" role="status">
      <strong>変更できません：</strong>
      {reason}
    </p>
  );
}

export function teamLabel(team: Team, universityName: string | undefined) {
  return `${universityName ?? team.displayName}（${GENDER_LABEL[team.gender]}）`;
}

export function yen(n: number) {
  return n.toLocaleString("ja-JP") + "円";
}

export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const w = "日月火水木金土"[new Date(y, m - 1, day).getDay()];
  return `${y}年${m}月${day}日（${w}）`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 指摘に氏名をつけ、「写真掲載の同意なし」は1行にまとめる（画面表示用） */
export function namedIssues(issues: Issue[], members: Member[]): Issue[] {
  const noConsent: string[] = [];
  const out: Issue[] = [];
  for (const i of issues) {
    const who = i.memberId ? members.find((m) => m.id === i.memberId) : undefined;
    if (i.field === "photoConsent" && who) {
      noConsent.push(who.name || "氏名未入力");
      continue;
    }
    out.push(who && !i.message.includes("重複") ? { ...i, message: `【${who.name || "氏名未入力"}】${i.message}` } : i);
  }
  if (noConsent.length)
    out.push({ level: "warning", message: `写真の掲載に同意していない人が${noConsent.length}名います（写真なしで掲載）：${noConsent.join("、")}` });
  return out;
}
