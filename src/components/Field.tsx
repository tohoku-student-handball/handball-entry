"use client";
import type { ReactNode } from "react";
import type { Issue } from "@/lib/validation";

/** 入力欄1つ分（ラベル・必須表示・説明・その項目のエラー） */
export function Field({
  label,
  required,
  hint,
  issues,
  field,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  issues?: Issue[];
  field?: string;
  children: ReactNode;
}) {
  const mine = field && issues ? issues.filter((i) => i.field === field) : [];
  const hasError = mine.some((i) => i.level === "error");
  return (
    <div className={"field" + (hasError ? " field-error" : "")}>
      <label>
        <span className="field-label">
          {label}
          {required && <span className="req">必須</span>}
        </span>
        {children}
      </label>
      {hint && <p className="hint">{hint}</p>}
      {mine.map((i, k) => (
        <p key={k} className={i.level === "error" ? "msg-error" : "msg-warn"}>
          {i.message}
        </p>
      ))}
    </div>
  );
}

export function IssueList({ issues: raw, empty }: { issues: Issue[]; empty?: string }) {
  // 同じ文言の指摘（背番号の重複など、2人に同じ指摘がつくもの）は1つにまとめる
  const issues = [...new Map(raw.map((i) => [i.level + i.message, i])).values()];
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warning");
  if (!issues.length) return empty ? <p className="ok-box">{empty}</p> : null;
  return (
    <div className="issue-box">
      {errors.length > 0 && (
        <>
          <p className="issue-head error">直す必要がある項目（{errors.length}件）</p>
          <ul>
            {errors.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </>
      )}
      {warns.length > 0 && (
        <>
          <p className="issue-head warn">ご確認ください（{warns.length}件）</p>
          <ul>
            {warns.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
