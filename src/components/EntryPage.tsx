"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAFF_TITLES, toMember, type Entry, type RosterPerson, type Team } from "@/lib/types";
import { lockReason, validateTeam } from "@/lib/validation";
import { IssueList } from "./Field";
import { go, href } from "./router";
import { ActionButton, LockBanner, namedIssues } from "./ui";

type Choice = "entry" | "name_only" | "none";

/** 大会ごとのエントリー：部員名簿から選び、この大会の背番号・ベンチを決める */
export function EntryPage({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const f = store.features();
  const L = s.limits;
  const locked = lockReason(team, s);
  const roster = store.roster(team.universityId, team.gender);
  const current = store.entries(team.id);

  const [list, setList] = useState<Entry[]>(current);
  const byPerson = useMemo(() => new Map(list.map((e) => [e.personId, e])), [list]);
  const people = roster.filter((p) => p.active || byPerson.has(p.id));
  const players = people.filter((p) => p.kind === "player");
  const staff = people.filter((p) => p.kind === "staff");

  const choiceOf = (p: RosterPerson): Choice => {
    const e = byPerson.get(p.id);
    return !e ? "none" : e.isEntry ? "entry" : "name_only";
  };
  const update = (personId: string, patch: Partial<Entry> | null) => {
    setList((cur) => {
      const e = cur.find((x) => x.personId === personId);
      if (patch === null) return cur.filter((x) => x.personId !== personId);
      if (e) return cur.map((x) => (x.personId === personId ? { ...x, ...patch } : x));
      return [...cur, { id: "", teamId: team.id, personId, isEntry: true, number: null, bench: false, title: "", insuranceOptIn: false, ...patch }];
    });
  };
  const setChoice = (p: RosterPerson, c: Choice) => {
    if (c === "none") update(p.id, null);
    else update(p.id, c === "entry" ? { isEntry: true } : { isEntry: false, number: null, bench: false });
  };

  // ルール判定（いま画面で選んでいる状態で）
  const members = list.flatMap((e) => {
    const p = roster.find((x) => x.id === e.personId);
    return p ? [toMember(p, e)] : [];
  });
  const teamIssues = validateTeam(team, members, s, f);
  const countIssues = namedIssues(
    teamIssues.filter((i) => (!i.memberId && !i.field) || i.field === "number" || i.field === "foreignStatus"),
    members,
  );
  const memberErrors = (personId: string) => {
    const e = byPerson.get(personId);
    return e ? teamIssues.filter((i) => i.memberId === e.id && i.level === "error" && i.field !== "number" && i.field !== "foreignStatus").length : 0;
  };
  const entries = members.filter((m) => m.kind === "player" && m.isEntry);
  const bench = entries.filter((m) => m.bench).length;
  const staffIn = members.filter((m) => m.kind === "staff");
  const foreign = entries.filter((m) => m.foreignStatus === "foreign");
  const dupNumbers = new Set(
    entries.map((m) => m.number).filter((n, i, a) => n !== null && a.indexOf(n) !== i),
  );

  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <LockBanner reason={locked} />
      <section className="card">
        <p>
          部員名簿から、この大会にエントリーする人を選び、<strong>この大会での背番号</strong>とベンチ登録を決めてください。
          名前や写真などを直すときは<a href={href(team.gender, "roster")}>部員名簿</a>で直します。
        </p>
        <div className="counters">
          <Counter label="エントリー" value={entries.length} max={L.playerEntryMax} />
          <Counter label="ベンチ（選手）" value={bench} max={L.benchPlayerMax} />
          <Counter label="役員" value={staffIn.length} max={L.staffMax} />
          <Counter label="留学生" value={foreign.length} max={L.foreignEntryMax} />
        </div>
        <IssueList issues={countIssues} />
        {roster.length === 0 && (
          <p className="notice">
            部員名簿がまだ空です。先に<a href={href(team.gender, "roster")}>部員名簿</a>に選手・役員を登録してください。
          </p>
        )}
      </section>

      <fieldset className="plain stack" disabled={!!locked}>
        <section className="card flush">
          <h3 className="pad">選手（名簿 {players.length}名）</h3>
          <div className="table-wrap">
            <table className="grid-table entry-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>エントリー</th>
                  <th>背番号</th>
                  <th>ベンチ</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const e = byPerson.get(p.id);
                  const c = choiceOf(p);
                  const errs = memberErrors(p.id);
                  return (
                    <tr key={p.id} className={c === "none" ? "row-off" : ""}>
                      <td>
                        <a href={href(team.gender, "roster", p.id)}>{p.name || "（氏名未入力）"}</a>
                        <span className="muted small block">
                          {[p.position, p.grade ? `${p.grade}年` : ""].filter(Boolean).join("・")}
                          {p.foreignStatus === "foreign" && "・留学生"}
                          {p.foreignStatus === "short_term" && "・短期留学生"}
                        </span>
                        {errs > 0 && c === "entry" && <span className="badge err">名簿の入力不足 {errs}</span>}
                      </td>
                      <td>
                        <select aria-label={`${p.name}のエントリー`} value={c} onChange={(ev) => setChoice(p, ev.target.value as Choice)}>
                          <option value="none">しない</option>
                          <option value="entry">エントリー</option>
                          {f.pamphlet && <option value="name_only">氏名のみ掲載</option>}
                        </select>
                      </td>
                      <td>
                        {c === "entry" && (
                          <input
                            aria-label={`${p.name}の背番号`}
                            className={"num-input" + (e?.number !== null && e?.number !== undefined && dupNumbers.has(e.number) ? " dup" : "")}
                            type="number"
                            inputMode="numeric"
                            min={L.numberMin}
                            max={L.numberMax}
                            value={e?.number ?? ""}
                            onChange={(ev) => update(p.id, { number: ev.target.value.trim() === "" ? null : Number(ev.target.value) })}
                          />
                        )}
                      </td>
                      <td className="c">
                        {c === "entry" && (
                          <input type="checkbox" aria-label={`${p.name}のベンチ登録`} checked={!!e?.bench} onChange={(ev) => update(p.id, { bench: ev.target.checked })} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card flush">
          <h3 className="pad">役員（名簿 {staff.length}名）</h3>
          <div className="table-wrap">
            <table className="grid-table entry-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>エントリー</th>
                  <th>この大会での役職</th>
                  <th>ベンチ</th>
                  {f.insurance && <th>保険</th>}
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => {
                  const e = byPerson.get(p.id);
                  const on = !!e;
                  return (
                    <tr key={p.id} className={on ? "" : "row-off"}>
                      <td>
                        <a href={href(team.gender, "roster", p.id)}>{p.name || "（氏名未入力）"}</a>
                        {p.isStudent && <span className="muted small block">学生</span>}
                      </td>
                      <td className="c">
                        <input type="checkbox" aria-label={`${p.name}をエントリー`} checked={on} onChange={(ev) => update(p.id, ev.target.checked ? { isEntry: true } : null)} />
                      </td>
                      <td>
                        {on && (
                          <select aria-label={`${p.name}の役職`} value={e!.title || p.defaultTitle} onChange={(ev) => update(p.id, { title: ev.target.value })}>
                            {STAFF_TITLES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="c">
                        {on && <input type="checkbox" aria-label={`${p.name}のベンチ登録`} checked={e!.bench} onChange={(ev) => update(p.id, { bench: ev.target.checked })} />}
                      </td>
                      {f.insurance && (
                        <td className="small">
                          {on &&
                            (p.isStudent ? (
                              "加入（学生）"
                            ) : (
                              <label className="check compact">
                                <input type="checkbox" checked={e!.insuranceOptIn} onChange={(ev) => update(p.id, { insuranceOptIn: ev.target.checked })} />
                                <span>任意加入</span>
                              </label>
                            ))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </fieldset>

      <div className="actions sticky">
        <button type="button" className="btn" onClick={() => go(team.gender)}>
          {locked ? "戻る" : "保存せずに戻る"}
        </button>
        {!locked && (
          <ActionButton
            onClick={async () => {
              await store.saveEntries(team.id, list);
              go(team.gender);
            }}
            busyLabel="保存中…"
          >
            保存する
          </ActionButton>
        )}
      </div>
    </form>
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
