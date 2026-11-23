"use client";
import { useStore } from "@/lib/store";
import { GENDER_LABEL, PAPER_STATUS_LABEL, TEAM_STATUS_LABEL, type Team, type TeamStatus } from "@/lib/types";
import { validateSubmission } from "@/lib/validation";
import { href } from "./router";
import { StatusBadge, formatDateTime } from "./ui";

export interface TeamRow {
  team: Team;
  errors: number;
  entries: number;
  photoMissing: number;
}

export function useTeamRows(teams: Team[]): TeamRow[] {
  const store = useStore();
  const s = store.settings();
  return teams.map((team) => {
    const members = store.members(team.id);
    const issues = validateSubmission(team, members, store.uniforms(team.id), store.assets(team.id), s, store.features());
    return {
      team,
      errors: issues.filter((i) => i.level === "error").length,
      entries: members.filter((m) => m.kind === "player" && m.isEntry).length,
      photoMissing: members.filter((m) => (m.kind === "staff" || m.isEntry) && m.photoConsent && !m.photoKey).length,
    };
  });
}

const STATUS_ORDER: TeamStatus[] = ["submitted", "returned", "in_progress", "not_started", "region_approved", "office_confirmed"];
const ONE_STEP_ORDER: TeamStatus[] = ["submitted", "returned", "in_progress", "not_started", "office_confirmed"];

/** 状態ごとの件数 */
export function StatusCounts({ rows, extraNotStarted = 0 }: { rows: TeamRow[]; extraNotStarted?: number }) {
  const oneStep = useStore().tournament().reviewFlow === "one_step";
  const count = (st: TeamStatus) => rows.filter((r) => r.team.status === st).length + (st === "not_started" ? extraNotStarted : 0);
  return (
    <div className="counters">
      {(oneStep ? ONE_STEP_ORDER : STATUS_ORDER).map((st) => (
        <div key={st} className={"counter" + (st === "submitted" && count(st) > 0 ? " attention" : "")}>
          <span className="counter-label">{TEAM_STATUS_LABEL[st].replace(/（.*）/, "")}</span>
          <span className="counter-value">{count(st)}</span>
        </div>
      ))}
    </div>
  );
}

/** チームの一覧表（地区学連・事務局） */
export function TeamTable({ rows, area, showRegion }: { rows: TeamRow[]; area: "region" | "office"; showRegion?: boolean }) {
  const store = useStore();
  const f = store.features();
  const league = store.divisions().length > 0;
  const sorted = [...rows].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.team.status) - STATUS_ORDER.indexOf(b.team.status) ||
      (store.university(a.team.universityId)?.name ?? "").localeCompare(store.university(b.team.universityId)?.name ?? "", "ja"),
  );
  if (!rows.length) return <p className="muted pad">該当するチームはありません。</p>;
  return (
    <div className="table-wrap">
      <table className="grid-table team-table">
        <thead>
          <tr>
            <th>大学（男女）</th>
            {league ? <th>部</th> : showRegion && <th>地区</th>}
            <th>状態</th>
            <th>入力の不足</th>
            <th>エントリー</th>
            {f.pamphlet && <th>写真</th>}
            {f.paper && <th>原本</th>}
            <th>提出日時</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ team, errors, entries, photoMissing }) => (
            <tr key={team.id}>
              <td>
                <a href={href(area, "team", team.id)} className="strong-link">
                  {store.university(team.universityId)?.name}（{GENDER_LABEL[team.gender]}）
                </a>
              </td>
              {league ? <td>{store.division(team.divisionId)?.name ?? "未設定"}</td> : showRegion && <td>{store.region(team.regionId)?.name}</td>}
              <td><StatusBadge status={team.status} /></td>
              <td>{errors ? <span className="badge err">{errors}件</span> : <span className="badge okb">なし</span>}</td>
              <td className="num-cell">{entries}名</td>
              {f.pamphlet && <td>{photoMissing ? <span className="badge err">不足{photoMissing}</span> : "そろい"}</td>}
              {f.paper && <td>{PAPER_STATUS_LABEL[team.paperStatus]}</td>}
              <td className="small">{team.submittedAt ? formatDateTime(team.submittedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
