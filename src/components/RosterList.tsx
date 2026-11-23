"use client";
import { usePhotoUrl, useStore } from "@/lib/store";
import { FOREIGN_LABEL, GENDER_LABEL, personAsMember, type Gender, type RosterPerson } from "@/lib/types";
import { isMinor, validateMember } from "@/lib/validation";
import { href } from "./router";

/** 年度の部員名簿（大学×男女×年度。全大会で共通） */
export function RosterList({ universityId, gender }: { universityId: string; gender: Gender }) {
  const store = useStore();
  const s = store.settings();
  const f = store.features();
  const year = store.tournament().academicYear;
  const all = store.roster(universityId, gender);
  const active = all.filter((p) => p.active);
  const inactive = all.filter((p) => !p.active);
  const players = active.filter((p) => p.kind === "player").sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0) || a.kana.localeCompare(b.kana, "ja"));
  const staff = active.filter((p) => p.kind === "staff");
  const errorsOf = (p: RosterPerson) =>
    validateMember(personAsMember(p), s, f).filter((i) => i.level === "error" && i.field !== "number" && i.field !== "title").length;

  return (
    <div className="stack">
      <section className="card">
        <p>
          {store.university(universityId)?.name}（{GENDER_LABEL[gender]}）の<strong>{year}年度の部員名簿</strong>です。
          ここに入れた人の中から、大会ごとに「エントリー」で背番号を決めて申し込みます。
        </p>
        <div className="counters">
          <div className="counter">
            <span className="counter-label">選手</span>
            <span className="counter-value">{players.length}</span>
          </div>
          <div className="counter">
            <span className="counter-label">役員</span>
            <span className="counter-value">{staff.length}</span>
          </div>
        </div>
        <div className="row">
          <a className="btn primary" href={href(gender, "roster", "new-player")}>＋ 選手を追加</a>
          <a className="btn" href={href(gender, "roster", "new-staff")}>＋ 役員を追加</a>
        </div>
      </section>

      <section className="card flush">
        <h3 className="pad">選手（{players.length}名）</h3>
        {players.length === 0 ? (
          <p className="pad muted">まだ登録されていません。</p>
        ) : (
          <ul className="member-list">
            {players.map((p) => (
              <PersonRow key={p.id} p={p} errors={errorsOf(p)} minor={isMinor(personAsMember(p), s)} gender={gender} />
            ))}
          </ul>
        )}
      </section>

      <section className="card flush">
        <h3 className="pad">役員（{staff.length}名）</h3>
        {staff.length === 0 ? (
          <p className="pad muted">まだ登録されていません。</p>
        ) : (
          <ul className="member-list">
            {staff.map((p) => (
              <PersonRow key={p.id} p={p} errors={errorsOf(p)} minor={false} gender={gender} />
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <details className="card">
          <summary>名簿から外した人（{inactive.length}名）</summary>
          <ul className="member-list">
            {inactive.map((p) => (
              <PersonRow key={p.id} p={p} errors={0} minor={false} gender={gender} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PersonRow({ p, errors, minor, gender }: { p: RosterPerson; errors: number; minor: boolean; gender: Gender }) {
  const photo = usePhotoUrl(p.photoKey);
  return (
    <li>
      <a href={href(gender, "roster", p.id)} className="member-row">
        <div className="thumb">{photo ? <img src={photo} alt="" /> : <span>{p.photoConsent ? "写真\nなし" : "掲載\n不可"}</span>}</div>
        <span className="member-main">
          <span className="member-name">{p.name || "（氏名未入力）"}</span>
          <span className="member-sub">
            {p.kind === "staff" ? p.defaultTitle : [p.position, p.grade ? `${p.grade}年` : ""].filter(Boolean).join("・")}
            {p.foreignStatus !== "none" && <span className="tag">{FOREIGN_LABEL[p.foreignStatus]}</span>}
            {minor && <span className="tag">未成年</span>}
            {!p.active && <span className="tag">名簿から外した人</span>}
          </span>
        </span>
        {errors > 0 ? <span className="badge err">未入力 {errors}</span> : <span className="badge okb">OK</span>}
        <span className="chev">›</span>
      </a>
    </li>
  );
}
