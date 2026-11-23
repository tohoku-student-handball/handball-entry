"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { GENDER_LABEL, PAPER_STATUS_LABEL, type Team } from "@/lib/types";
import { validateSubmission } from "@/lib/validation";
import { Comments } from "./Comments";
import { Field, IssueList } from "./Field";
import { href } from "./router";
import { TeamSummary } from "./TeamSummary";
import { ActionButton, StatusBadge, formatDateTime, namedIssues } from "./ui";

/** R-1 / A-1 申込内容の確認と、承認・差し戻し・事務局確認・ロック解除 */
export function TeamReview({ team, as }: { team: Team; as: "region" | "office" }) {
  const store = useStore();
  const s = store.settings();
  const members = store.members(team.id);
  const f = store.features();
  const oneStep = store.tournament().reviewFlow === "one_step";
  const division = store.division(team.divisionId);
  const issues = namedIssues(validateSubmission(team, members, store.uniforms(team.id), store.assets(team.id), s, f), members);
  const [comment, setComment] = useState("");
  const office = as === "office";
  const canApprove = team.status === "submitted";
  const canReturn = team.status === "submitted" || (office && ["region_approved", "office_confirmed"].includes(team.status));
  const canConfirm = office && !oneStep && team.status === "region_approved";
  const submitted = ["submitted", "region_approved", "office_confirmed"].includes(team.status);

  return (
    <div className="stack">
      <section className="card">
        <div className="status-row">
          <div>
            <p className="muted small">{division ? division.name : `${store.region(team.regionId)?.name}地区`}</p>
            <h2 className="team-name">
              {store.university(team.universityId)?.name}（{GENDER_LABEL[team.gender]}）
            </h2>
          </div>
          <StatusBadge status={team.status} />
        </div>
        {team.submittedAt && <p className="small muted">提出：{formatDateTime(team.submittedAt)}</p>}
        <IssueList issues={issues} empty="入力の不足・ルール違反は見つかりませんでした。" />
      </section>

      {(canApprove || canReturn || canConfirm) && (
        <section className="card stack">
          <h3>{oneStep ? "主催者の確認" : office ? "事務局の確認" : "地区学連の確認"}</h3>
          <Field label="コメント（差し戻すときは必須）" hint="チームの担当者に表示され、メールでも通知されます（メール通知は M4 で追加）。">
            <textarea id="review-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="row">
            {canApprove && (
              <ActionButton onClick={() => store.review(team.id, "approve", comment).then(() => setComment(""))}>
                {oneStep ? "承認する（受付完了）" : "承認する"}
              </ActionButton>
            )}
            {canConfirm && (
              <ActionButton onClick={() => store.review(team.id, "confirm", comment).then(() => setComment(""))}>
                事務局確認済にする
              </ActionButton>
            )}
            {canReturn && (
              <ActionButton className="btn danger-outline" onClick={() => store.review(team.id, "return", comment).then(() => setComment(""))}>
                差し戻す
              </ActionButton>
            )}
          </div>
          {office && !oneStep && team.status === "submitted" && <p className="hint">通常は地区学連が承認します。事務局も代わりに承認できます。</p>}
        </section>
      )}

      {f.paper && (
      <section className="card stack">
        <h3>申込書の原本</h3>
        <p>
          状態：<strong>{PAPER_STATUS_LABEL[team.paperStatus]}</strong>
        </p>
        <div className="row">
          <a className="btn" href={href(as, "print", team.id)}>申込書を表示する</a>
          {submitted && team.paperStatus !== "received" && (
            <ActionButton className="btn" onClick={() => store.setPaperStatus(team.id, "received")}>
              原本の到着を記録する
            </ActionButton>
          )}
          {team.paperStatus === "received" && (
            <ActionButton className="btn link" onClick={() => store.setPaperStatus(team.id, "sent")}>
              到着の記録を取り消す
            </ActionButton>
          )}
        </div>
      </section>
      )}

      {office && <OfficeTools team={team} />}
      <Comments teamId={team.id} />
      <h2 className="section-title">申込内容</h2>
      <TeamSummary team={team} />
    </div>
  );
}

function OfficeTools({ team }: { team: Team }) {
  const store = useStore();
  const [until, setUntil] = useState(() => {
    const d = new Date(Date.now() + 3 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState("");
  const unlocked = team.unlockedUntil && new Date(team.unlockedUntil) > new Date();

  return (
    <section className="card stack">
      <h3>事務局の操作</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={team.registrationConfirmed}
          onChange={(e) => store.setRegistrationConfirmed(team.id, e.target.checked)}
        />
        <span>JHA・全日本学連の登録完了を確認した（JHA {team.jhaNumber || "未入力"}／学連 {team.studentFedNumber || "未入力"}）</span>
      </label>

      <div>
        <p className="field-label">締切後のロック解除</p>
        {unlocked ? (
          <div className="row">
            <span>{formatDateTime(team.unlockedUntil!)} まで解除中</span>
            <ActionButton className="btn" onClick={() => store.unlock(team.id, null, "")}>
              解除を取り消す
            </ActionButton>
          </div>
        ) : (
          <div className="stack">
            <p className="hint">締切後に、このチームだけ名簿などを変更できるようにします。提出済みのチームを直させる場合は、先に「差し戻す」を使ってください。</p>
            <div className="grid2">
              <Field label="いつまで解除するか">
                <input id="unlock-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </Field>
              <Field label="理由（必須・記録に残ります）">
                <input id="unlock-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <div>
              <ActionButton className="btn" onClick={() => store.unlock(team.id, `${until}T23:59:59+09:00`, reason).then(() => setReason(""))}>
                ロックを解除する
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
