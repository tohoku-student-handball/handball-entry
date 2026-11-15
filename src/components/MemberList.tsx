"use client";
import { useStore, usePhotoUrl } from "@/lib/store";
import { FOREIGN_LABEL, type Member, type MemberKind, type Team } from "@/lib/types";
import { isMinor, validateTeam, type Issue } from "@/lib/validation";
import { IssueList } from "./Field";
import { href } from "./router";

/** T-2 選手名簿 / T-3 役員名簿 */
export function MemberList({ team, kind }: { team: Team; kind: MemberKind }) {
  const store = useStore();
  const s = store.settings();
  const L = s.limits;
  const all = store.members(team.id);
  const issues = validateTeam(team, all, s);
  const list = all.filter((m) => m.kind === kind);
  const g = team.gender;

  const entries = list.filter((m) => m.isEntry).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  const nameOnly = list.filter((m) => !m.isEntry);
  const bench = list.filter((m) => m.bench && (kind === "staff" || m.isEntry)).length;
  const foreign = entries.filter((m) => m.foreignStatus === "foreign");

  // 名簿全体にかかわる指摘だけを上に出す（個人の指摘は各行に表示）
  const teamIssues = issues.filter(
    (i) => !i.field && !i.memberId && (kind === "player" ? /選手|留学生|背番号/.test(i.message) : /役員/.test(i.message)),
  );
  const dupIssues = kind === "player" ? issues.filter((i) => i.message.includes("重複")) : [];
  const uniqueDup = [...new Map(dupIssues.map((i) => [i.message, i])).values()];

  return (
    <div className="stack">
      <section className="card">
        <div className="counters">
          {kind === "player" ? (
            <>
              <Counter label="エントリー" value={entries.length} max={L.playerEntryMax} />
              <Counter label="ベンチ登録" value={bench} max={L.benchPlayerMax} />
              <Counter label="留学生" value={foreign.length} max={L.foreignEntryMax} />
              <Counter label="うちベンチ" value={foreign.filter((m) => m.bench).length} max={L.foreignGameEntryMax} />
            </>
          ) : (
            <>
              <Counter label="役員" value={list.length} max={L.staffMax} />
              <Counter label="ベンチ登録" value={bench} max={L.benchStaffMax} />
            </>
          )}
        </div>
        <IssueList issues={[...teamIssues, ...uniqueDup]} />
        <a className="btn primary block" href={href(g, kind === "player" ? "players" : "staff", "new")}>
          ＋ {kind === "player" ? "選手" : "役員"}を追加する
        </a>
      </section>

      <section className="card flush">
        <h3 className="pad">{kind === "player" ? `エントリー選手（${entries.length}名・背番号順）` : `役員（${list.length}名）`}</h3>
        {(kind === "player" ? entries : list).length === 0 ? (
          <p className="pad muted">まだ登録されていません。</p>
        ) : (
          <ul className="member-list">
            {(kind === "player" ? entries : list).map((m) => (
              <MemberRow key={m.id} m={m} issues={issues.filter((i) => i.memberId === m.id)} minor={isMinor(m, s)} to={href(g, kind === "player" ? "players" : "staff", m.id)} />
            ))}
          </ul>
        )}
      </section>

      {kind === "player" && (
        <section className="card flush">
          <h3 className="pad">氏名のみ掲載の部員（{nameOnly.length}名）</h3>
          <p className="pad hint">エントリー25名以外の部員です。パンフレットには氏名だけが載ります。</p>
          {nameOnly.length > 0 && (
            <ul className="member-list">
              {nameOnly.map((m) => (
                <MemberRow key={m.id} m={m} issues={issues.filter((i) => i.memberId === m.id)} minor={false} to={href(g, "players", m.id)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Counter({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className={"counter" + (value > max ? " over" : "")}>
      <span className="counter-label">{label}</span>
      <span className="counter-value">
        {value}
        <small>/{max}</small>
      </span>
    </div>
  );
}

function MemberRow({ m, issues, minor, to }: { m: Member; issues: Issue[]; minor: boolean; to: string }) {
  const photo = usePhotoUrl(m.photoKey);
  const errors = issues.filter((i) => i.level === "error").length;
  const full = m.kind === "staff" || m.isEntry;
  return (
    <li>
      <a href={to} className="member-row">
        {full && <div className="thumb">{photo ? <img src={photo} alt="" /> : <span>{m.photoConsent ? "写真\nなし" : "掲載\n不可"}</span>}</div>}
        {m.kind === "player" && m.isEntry && <span className="num">{m.number ?? "—"}</span>}
        <span className="member-main">
          <span className="member-name">{m.name || "（氏名未入力）"}</span>
          <span className="member-sub">
            {m.kind === "staff" ? m.title : m.isEntry ? [m.position, m.grade ? `${m.grade}年` : ""].filter(Boolean).join("・") : "氏名のみ"}
            {m.bench && <span className="tag">ベンチ</span>}
            {m.foreignStatus !== "none" && <span className="tag">{FOREIGN_LABEL[m.foreignStatus]}</span>}
            {minor && <span className="tag">未成年</span>}
          </span>
        </span>
        {errors > 0 ? <span className="badge err">要修正 {errors}</span> : <span className="badge okb">OK</span>}
        <span className="chev">›</span>
      </a>
    </li>
  );
}
