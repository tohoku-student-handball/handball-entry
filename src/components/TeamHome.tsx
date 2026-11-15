"use client";
import { useStore } from "@/lib/store";
import { GENDER_LABEL, TEAM_STATUS_LABEL, type Team } from "@/lib/types";
import { feeSummary, validateTeam } from "@/lib/validation";
import { IssueList } from "./Field";
import { href } from "./router";

/** T-0 チームのトップ：進み具合と、あと何をすればよいか */
export function TeamHome({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const members = store.members(team.id);
  const issues = validateTeam(team, members, s);
  const players = members.filter((m) => m.kind === "player");
  const entries = players.filter((m) => m.isEntry);
  const staff = members.filter((m) => m.kind === "staff");
  const fees = feeSummary(members, s);
  const g = team.gender;

  const memberIssues = (kind: "player" | "staff") =>
    issues.filter((i) => i.level === "error" && i.memberId && members.find((m) => m.id === i.memberId)?.kind === kind).length;
  const infoErrors = issues.filter((i) => i.level === "error" && !i.memberId && ["contact", "jha", "fed", "escort"].includes(i.field ?? "")).length;
  const photoMissing = members.filter((m) => (m.kind === "staff" || m.isEntry) && m.photoConsent && !m.photoKey).length;

  const days = Math.ceil((new Date(s.entryDeadline + "T23:59:59+09:00").getTime() - Date.now()) / 86400000);

  return (
    <div className="stack">
      <section className="card">
        <div className="status-row">
          <div>
            <p className="muted small">{GENDER_LABEL[g]}チーム／{store.region(team.regionId)?.name}地区</p>
            <h2 className="team-name">{team.displayName}</h2>
          </div>
          <span className={`badge status-${team.status}`}>{TEAM_STATUS_LABEL[team.status]}</span>
        </div>
        <p className="deadline">
          申込締切：<strong>{formatDate(s.entryDeadline)}</strong>
          {days >= 0 ? <span className="muted">（あと{days}日）</span> : <span className="msg-error">（締切を過ぎています）</span>}
        </p>
      </section>

      <section className="card">
        <h3>やることリスト</h3>
        <ul className="todo">
          <Todo to={href(g, "info")} title="基本情報・登録番号・引率責任者" done={infoErrors === 0} detail={infoErrors ? `未入力・要確認 ${infoErrors}件` : "入力済み"} />
          <Todo
            to={href(g, "players")}
            title="選手名簿"
            done={memberIssues("player") === 0 && entries.length > 0 && entries.length <= s.limits.playerEntryMax}
            detail={`エントリー ${entries.length}/${s.limits.playerEntryMax}名・氏名のみ ${players.length - entries.length}名${memberIssues("player") ? `・要修正 ${memberIssues("player")}件` : ""}`}
          />
          <Todo
            to={href(g, "staff")}
            title="役員名簿"
            done={memberIssues("staff") === 0 && staff.length > 0 && staff.length <= s.limits.staffMax}
            detail={`${staff.length}/${s.limits.staffMax}名${memberIssues("staff") ? `・要修正 ${memberIssues("staff")}件` : ""}`}
          />
          <Todo to={href(g, "players")} title="顔写真" done={photoMissing === 0} detail={photoMissing ? `未提出 ${photoMissing}名` : "そろっています"} />
          <li className="todo-item later">
            <span className="todo-mark">…</span>
            <span>
              ユニフォーム・集合写真・ロゴ・提出（次の段階 M2 で追加）
              <br />
              <span className="muted small">保険・振込・交通宿泊は M3〜M4 で追加</span>
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
            <tr>
              <th>傷害保険料</th>
              <td>
                {yen(s.fees.insurancePerPerson)} × {fees.insured}名 = {yen(fees.insuranceFee)}
              </td>
            </tr>
            <tr className="total">
              <th>合計</th>
              <td>{yen(fees.total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">選手・学生役員は保険に全員加入、それ以外の役員は任意です。振込先と振込名義のルールは M3 で表示します。</p>
      </section>

      <section className="card">
        <h3>チェック結果</h3>
        <IssueList
          issues={issues.map((i) => {
            const who = i.memberId && !i.message.includes("重複") ? members.find((m) => m.id === i.memberId) : undefined;
            return who ? { ...i, message: `【${who.name || "氏名未入力"}】${i.message}` } : i;
          })}
          empty="すべての項目が入力済みです。"
        />
      </section>
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

export function yen(n: number) {
  return n.toLocaleString("ja-JP") + "円";
}
export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const w = "日月火水木金土"[new Date(y, m - 1, day).getDay()];
  return `${y}年${m}月${day}日（${w}）`;
}
