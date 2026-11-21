"use client";
import { useStore } from "@/lib/store";
import { StatusCounts, TeamTable, useTeamRows } from "./TeamTable";
import { formatDate } from "./ui";

/** R-0 自地区のチーム一覧 */
export function RegionList({ regionId }: { regionId: string }) {
  const store = useStore();
  const s = store.settings();
  const teams = store.teams().filter((t) => t.regionId === regionId);
  const rows = useTeamRows(teams);
  const universities = store.tournamentUniversities().filter((tu) => tu.regionId === regionId);
  const noTeam = universities.filter((tu) => !teams.some((t) => t.universityId === tu.universityId));
  const waiting = teams.filter((t) => t.status === "submitted").length;

  return (
    <div className="stack">
      <section className="card">
        <h2>{store.region(regionId)?.name}地区の申込状況</h2>
        <p className="muted small">申込締切：{formatDate(s.entryDeadline)}</p>
        {waiting > 0 && <p className="notice">確認待ちのチームが <strong>{waiting}件</strong> あります。チーム名を押して内容を確認し、承認または差し戻しをしてください。</p>}
        <StatusCounts rows={rows} />
      </section>
      <section className="card flush">
        <h3 className="pad">チーム一覧</h3>
        <TeamTable rows={rows} area="region" />
      </section>
      {noTeam.length > 0 && (
        <section className="card">
          <h3>まだ申込を始めていない大学（{noTeam.length}校）</h3>
          <p className="small">{noTeam.map((tu) => store.university(tu.universityId)?.name).join("、")}</p>
        </section>
      )}
    </div>
  );
}
