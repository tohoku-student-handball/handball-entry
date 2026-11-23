"use client";
import { useStore } from "@/lib/store";
import { GENDER_LABEL, PAPER_STATUS_LABEL, type Team } from "@/lib/types";
import { feeSummary, lockReason, sponsorFee, validateAssets, validateSubmission, validateUniforms } from "@/lib/validation";
import { Comments } from "./Comments";
import { IssueList } from "./Field";
import { href } from "./router";
import { LockBanner, StatusBadge, formatDate, formatDateTime, namedIssues, yen } from "./ui";

/** T-0 チームのトップ：進み具合と、あと何をすればよいか */
export function TeamHome({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const members = store.members(team.id);
  const uniforms = store.uniforms(team.id);
  const assets = store.assets(team.id);
  const f = store.features();
  const division = store.division(team.divisionId);
  const issues = validateSubmission(team, members, uniforms, assets, s, f);
  const players = members.filter((m) => m.kind === "player");
  const entries = players.filter((m) => m.isEntry);
  const staff = members.filter((m) => m.kind === "staff");
  const fees = feeSummary(members, s, { insurance: f.insurance, entryFee: division?.entryFee });
  const sponsor = sponsorFee(uniforms, s);
  const g = team.gender;
  const errorCount = issues.filter((i) => i.level === "error").length;

  const memberIssues = (kind: "player" | "staff") =>
    issues.filter((i) => i.level === "error" && i.memberId && members.find((m) => m.id === i.memberId)?.kind === kind).length;
  const infoErrors = issues.filter((i) => i.level === "error" && !i.memberId && ["contact", "jha", "fed", "escort"].includes(i.field ?? "")).length;
  const rosterCount = store.roster(team.universityId, team.gender).filter((p) => p.active).length;
  const entryErrors = issues.filter((i) => i.level === "error" && (!i.memberId ? !["contact", "jha", "fed", "escort", "uniform", "asset"].includes(i.field ?? "") : i.field === "number" || i.field === "foreignStatus")).length;
  const photoMissing = members.filter((m) => (m.kind === "staff" || m.isEntry) && m.photoConsent && !m.photoKey).length;
  const uniformErrors = validateUniforms(uniforms).length;
  const assetErrors = validateAssets(assets).length;
  const submitted = ["submitted", "region_approved", "office_confirmed"].includes(team.status);
  const returned = team.status === "returned";
  const lastReturn = [...store.comments(team.id)].reverse().find((c) => c.action === "return");

  const days = Math.ceil((new Date(s.entryDeadlineAt).getTime() - Date.now()) / 86400000);

  return (
    <div className="stack">
      <section className="card">
        <div className="status-row">
          <div>
            <p className="muted small">
              {store.tournament().shortName}／{GENDER_LABEL[g]}チーム
              {division ? `／${division.name}` : `／${store.region(team.regionId)?.name}地区`}
            </p>
            <h2 className="team-name">{team.displayName}</h2>
          </div>
          <StatusBadge status={team.status} />
        </div>
        <p className="deadline">
          申込締切：<strong>{formatDate(s.entryDeadline)}</strong>
          {days >= 0 ? <span className="muted">（あと{days}日）</span> : <span className="msg-error">（締切を過ぎています）</span>}
        </p>
        {team.unlockedUntil && new Date(team.unlockedUntil) > new Date() && (
          <p className="notice">事務局がロックを解除しています（{formatDateTime(team.unlockedUntil)} まで変更できます）。</p>
        )}
      </section>

      {returned && lastReturn && (
        <section className="card returned-box">
          <h3>差し戻されています</h3>
          <p className="pre">{lastReturn.body}</p>
          <p className="hint">内容を直して、もう一度「最終確認・提出」から提出してください。</p>
        </section>
      )}

      {submitted && (
        <section className="card">
          <h3>提出済みです</h3>
          <p>
            {team.status === "submitted" && "地区学連の確認をお待ちください。"}
            {team.status === "region_approved" && "地区学連が承認しました。事務局の確認をお待ちください。"}
            {team.status === "office_confirmed" && "事務局の確認が終わりました。申込は完了です。"}
          </p>
          <p>
            申込書原本：<strong>{PAPER_STATUS_LABEL[team.paperStatus]}</strong>
          </p>
          <a className="btn" href={href(g, "submit")}>提出内容・申込書の印刷へ</a>
        </section>
      )}
      <LockBanner reason={submitted ? null : lockReason(team, s)} />

      <section className="card">
        <h3>やることリスト</h3>
        <ul className="todo">
          <Todo to={href(g, "info")} title={f.escort ? "基本情報・登録番号・引率責任者" : "基本情報・登録番号"} done={infoErrors === 0} detail={infoErrors ? `未入力・要確認 ${infoErrors}件` : "入力済み"} />
          <Todo
            to={href(g, "roster")}
            title="部員名簿（年度・全大会で共通）"
            done={rosterCount > 0 && memberIssues("player") + memberIssues("staff") === 0}
            detail={`${rosterCount}名登録${memberIssues("player") + memberIssues("staff") ? `・エントリーした人の入力不足 ${memberIssues("player") + memberIssues("staff")}件` : ""}`}
          />
          <Todo
            to={href(g, "entry")}
            title="エントリー（この大会の背番号・ベンチ）"
            done={entryErrors === 0 && entries.length > 0 && staff.length > 0}
            detail={`選手 ${entries.length}/${s.limits.playerEntryMax}名・役員 ${staff.length}/${s.limits.staffMax}名${f.pamphlet ? `・氏名のみ ${players.length - entries.length}名` : ""}${entryErrors ? `・要修正 ${entryErrors}件` : ""}`}
          />
          {f.pamphlet && <Todo to={href(g, "roster")} title="顔写真" done={photoMissing === 0} detail={photoMissing ? `未提出 ${photoMissing}名` : "そろっています"} />}
          <Todo to={href(g, "uniform")} title="ユニフォーム" done={uniformErrors === 0} detail={uniformErrors ? "CP用・GK用の濃色・淡色を登録してください" : `${uniforms.length}着種 登録済み`} />
          {f.pamphlet && <Todo to={href(g, "assets")} title="集合写真・ロゴ" done={assetErrors === 0} detail={assetErrors ? `未提出 ${assetErrors}件` : "そろっています"} />}
          <Todo
            to={href(g, "submit")}
            title={submitted ? (f.paper ? "提出内容・申込書の印刷" : "提出内容") : "最終確認・提出"}
            done={submitted}
            detail={submitted ? "提出済み" : errorCount ? `直す必要がある項目 ${errorCount}件` : "提出できます"}
          />
          <li className="todo-item later">
            <span className="todo-mark">…</span>
            <span>
              参加費の振込（M3で追加）{f.travel ? "／交通・宿泊・弁当（M4で追加）" : ""}{f.matches ? "／試合ごとのメンバー提出（2月に追加）" : ""}
            </span>
          </li>
        </ul>
      </section>

      <section className="card">
        <h3>参加料の見込み</h3>
        <table className="kv">
          <tbody>
            <tr>
              <th>参加料</th>
              <td>{yen(fees.entryFee)}</td>
            </tr>
            {f.insurance && (
              <tr>
                <th>傷害保険料</th>
                <td>
                  {yen(s.fees.insurancePerPerson)} × {fees.insured}名 = {yen(fees.insuranceFee)}
                </td>
              </tr>
            )}
            <tr className="total">
              <th>振込額の合計</th>
              <td>{yen(fees.total)}</td>
            </tr>
          </tbody>
        </table>
        {sponsor.count > 0 && (
          <p className="notice">
            協賛企業名入りユニフォーム：{sponsor.count}着種 × {yen(s.fees.sponsorUniform)} = {yen(sponsor.amount)}（振込ではなく、大会当日に現金でお支払いください）
          </p>
        )}
        <p className="hint">
          {f.insurance && "選手・学生役員は保険に全員加入、それ以外の役員は任意です。"}
          {fees.entryFee === 0 && "参加料は主催者が設定中です。"}振込先と振込名義のルールは M3 で表示します。
        </p>
      </section>

      <section className="card">
        <h3>チェック結果</h3>
        <IssueList
          issues={namedIssues(issues, members)}
          empty="すべての項目が入力済みです。「最終確認・提出」から提出できます。"
        />
      </section>

      <Comments teamId={team.id} />
    </div>
  );
}

function Todo({ to, title, done, detail }: { to: string; title: string; done: boolean; detail: string }) {
  return (
    <li>
      <a className={"todo-item" + (done ? " done" : "")} href={to}>
        <span className="todo-mark">{done ? "✓" : "!"}</span>
        <span className="todo-body">
          {title}
          <br />
          <span className="muted small">{detail}</span>
        </span>
        <span className="chev">›</span>
      </a>
    </li>
  );
}
