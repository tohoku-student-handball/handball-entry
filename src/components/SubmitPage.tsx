"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PAPER_STATUS_LABEL, type Team } from "@/lib/types";
import { lockReason, validateSubmission } from "@/lib/validation";
import { Comments } from "./Comments";
import { IssueList } from "./Field";
import { href } from "./router";
import { TeamSummary } from "./TeamSummary";
import { ActionButton, LockBanner, StatusBadge, namedIssues } from "./ui";

/** T-10 最終確認・提出 / T-11 申込書の印刷と原本 */
export function SubmitPage({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const issues = validateSubmission(team, store.members(team.id), store.uniforms(team.id), store.assets(team.id), s);
  const errors = issues.filter((i) => i.level === "error");
  const locked = lockReason(team, s);
  const submitted = ["submitted", "region_approved", "office_confirmed"].includes(team.status);
  const [agree, setAgree] = useState(false);
  const members = store.members(team.id);
  const named = namedIssues(issues, members);

  return (
    <div className="stack">
      <section className="card">
        <div className="status-row">
          <h3>申込の状態</h3>
          <StatusBadge status={team.status} />
        </div>
        {!submitted && !locked && (
          <>
            {errors.length > 0 ? (
              <>
                <p>提出する前に、次の項目を直してください。</p>
                <IssueList issues={named} />
              </>
            ) : (
              <div className="stack">
                {issues.length > 0 && <IssueList issues={named} />}
                <p>下の申込内容を確認し、間違いがなければ提出してください。提出すると、所属地区の地区学連に届きます。</p>
                <p className="notice">
                  <strong>提出後は、地区学連の確認が終わるまで内容を変更できません。</strong>
                  背番号は申込後に変更できません。
                </p>
                <label className="check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>申込内容に間違いがないことを確認しました</span>
                </label>
                <ActionButton onClick={() => store.submit(team.id)} disabled={!agree} busyLabel="提出中…">
                  提出する
                </ActionButton>
              </div>
            )}
          </>
        )}
        {!submitted && <LockBanner reason={locked} />}
        {submitted && (
          <p>
            {team.status === "submitted" && "提出済みです。地区学連の確認をお待ちください。"}
            {team.status === "region_approved" && "地区学連が承認しました。事務局の確認をお待ちください。"}
            {team.status === "office_confirmed" && "事務局の確認が終わりました。申込は完了です。"}
          </p>
        )}
      </section>

      <section className="card">
        <h3>申込書（様式Ⅰ・Ⅲ）の原本</h3>
        <p>
          申込書を印刷し、<strong>大学の角印</strong>を押して、所属地区の地区学連へ郵送してください。
          郵送したら「郵送しました」を押してください。
        </p>
        <p>
          状態：<strong>{PAPER_STATUS_LABEL[team.paperStatus]}</strong>
        </p>
        <div className="row">
          <a className="btn" href={href(team.gender, "print")}>
            申込書を表示・印刷する
          </a>
          {team.paperStatus === "not_sent" && (
            <ActionButton className="btn" onClick={() => store.setPaperStatus(team.id, "sent")}>
              郵送しました
            </ActionButton>
          )}
          {team.paperStatus === "sent" && (
            <ActionButton className="btn link" onClick={() => store.setPaperStatus(team.id, "not_sent")}>
              「郵送済」を取り消す
            </ActionButton>
          )}
        </div>
        <p className="hint">原本の扱い（郵送か、押印したPDFのアップロードか）は全日本学連と調整中です。決まり次第この画面を変更します。</p>
      </section>

      <Comments teamId={team.id} />
      <h2 className="section-title">申込内容</h2>
      <TeamSummary team={team} />
    </div>
  );
}
