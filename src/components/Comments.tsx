"use client";
import { useStore } from "@/lib/store";
import { REVIEW_ACTION_LABEL, ROLE_LABEL, type Role } from "@/lib/types";
import { formatDateTime } from "./ui";

/** 提出・承認・差し戻しの履歴 */
export function Comments({ teamId }: { teamId: string }) {
  const store = useStore();
  const list = store.comments(teamId);
  if (!list.length) return null;
  return (
    <section className="card">
      <h3>提出・確認の履歴</h3>
      <ol className="timeline">
        {[...list].reverse().map((c) => (
          <li key={c.id} className={"tl-" + c.action}>
            <span className="tl-head">
              <strong>{REVIEW_ACTION_LABEL[c.action]}</strong>
              <span className="muted small">
                {formatDateTime(c.createdAt)}・{ROLE_LABEL[c.authorRole as Role] ?? c.authorRole}
              </span>
            </span>
            {c.body && <span className="pre">{c.body}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
