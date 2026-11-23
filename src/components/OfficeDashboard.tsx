"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TEAM_STATUS_LABEL, type TeamStatus } from "@/lib/types";
import { href } from "./router";
import { StatusCounts, TeamTable, useTeamRows } from "./TeamTable";
import { formatDate } from "./ui";

/** A-0 事務局ダッシュボード */
export function OfficeDashboard() {
  const store = useStore();
  const s = store.settings();
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState<TeamStatus | "">("");
  const all = store.teams();
  const rows = useTeamRows(all);
  const filtered = rows.filter((r) => (!region || r.team.regionId === region) && (!status || r.team.status === status));
  const f = store.features();
  const divisions = store.divisions();
  const men = all.filter((t) => t.gender === "men").length;
  const women = all.filter((t) => t.gender === "women").length;
  const paperMissing = all.filter((t) => ["submitted", "region_approved", "office_confirmed"].includes(t.status) && t.paperStatus !== "received").length;
  const photoMissing = rows.filter((r) => r.photoMissing > 0).length;
  const unconfirmedReg = all.filter((t) => t.status !== "not_started" && !t.registrationConfirmed).length;

  return (
    <div className="stack">
      <section className="card">
        <div className="status-row">
          <h2>全体の申込状況</h2>
          <div className="row">
            <a className="btn" href={href("office", "settings")}>大会の設定</a>
            <a className="btn" href={href("office", "users")}>大学・担当者の登録</a>
          </div>
        </div>
        <p className="muted small">申込締切：{formatDate(s.entryDeadline)}</p>
        <div className="counters">
          {divisions.length > 0 ? (
            divisions.map((d) => {
              const n = all.filter((t) => t.divisionId === d.id).length;
              const planned = store.tournamentUniversities().filter((tu) => (d.gender === "men" ? tu.menDivisionId : tu.womenDivisionId) === d.id).length;
              return (
                <div key={d.id} className="counter">
                  <span className="counter-label">{d.name}</span>
                  <span className="counter-value">{n}<small>/{planned}校</small></span>
                </div>
              );
            })
          ) : (
            <>
              <div className="counter"><span className="counter-label">男子</span><span className="counter-value">{men}<small>/32</small></span></div>
              <div className="counter"><span className="counter-label">女子</span><span className="counter-value">{women}<small>/32</small></span></div>
            </>
          )}
          {f.paper && <div className={"counter" + (paperMissing ? " attention" : "")}><span className="counter-label">原本 未着</span><span className="counter-value">{paperMissing}</span></div>}
          {f.pamphlet && <div className={"counter" + (photoMissing ? " attention" : "")}><span className="counter-label">写真不足のチーム</span><span className="counter-value">{photoMissing}</span></div>}
          <div className={"counter" + (unconfirmedReg ? " attention" : "")}><span className="counter-label">登録番号 未確認</span><span className="counter-value">{unconfirmedReg}</span></div>
        </div>
        <StatusCounts rows={rows} />
        <p className="hint">未入金・リマインド送信は M3〜M4 で追加します。</p>
      </section>

      <section className="card flush">
        <div className="pad filter-row">
          {divisions.length === 0 && <label>
            <span className="field-label">地区</span>
            <select id="filter-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">すべて</option>
              {store.regions().map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>}
          <label>
            <span className="field-label">状態</span>
            <select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value as TeamStatus | "")}>
              <option value="">すべて</option>
              {(Object.keys(TEAM_STATUS_LABEL) as TeamStatus[]).map((st) => (
                <option key={st} value={st}>{TEAM_STATUS_LABEL[st]}</option>
              ))}
            </select>
          </label>
        </div>
        <TeamTable rows={filtered} area="office" showRegion />
      </section>
    </div>
  );
}
