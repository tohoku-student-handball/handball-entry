"use client";
import { useEffect, useState } from "react";
import { getStore, useStore } from "@/lib/store";
import { GENDER_LABEL, type Gender } from "@/lib/types";
import { ConfirmButton } from "./ConfirmButton";
import { MemberForm } from "./MemberForm";
import { MemberList } from "./MemberList";
import { go, href, useRoute } from "./router";
import { TeamHome } from "./TeamHome";
import { TeamInfoForm } from "./TeamInfoForm";

const TITLES: Record<string, string> = { info: "基本情報・引率責任者", players: "選手名簿", staff: "役員名簿" };

export function App() {
  // ブラウザ内のデータを読むため、画面はブラウザで開いてから描く
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className="loading">読み込み中…</div>;
  return <Shell />;
}

function Shell() {
  const store = useStore();
  const route = useRoute();
  const s = store.settings();
  const uni = store.university();
  const teams = store.teams();

  const gender: Gender | null = route[0] === "men" || route[0] === "women" ? route[0] : null;
  useEffect(() => {
    if (!gender) go(teams[0]?.gender ?? "men");
  }, [gender, teams]);
  if (!gender) return null;

  const team = teams.find((t) => t.gender === gender);
  const [, section, sub] = route;

  let body: React.ReactNode;
  if (!team) {
    body = (
      <section className="card center-text">
        <p>{uni.name}の{GENDER_LABEL[gender]}チームは、まだ作成されていません。</p>
        <button className="btn primary" onClick={() => getStore().createTeam(gender)}>
          {GENDER_LABEL[gender]}チームの申込を始める
        </button>
      </section>
    );
  } else if (section === "info") {
    body = <TeamInfoForm key={team.id} team={team} />;
  } else if (section === "players" || section === "staff") {
    const kind = section === "players" ? "player" : "staff";
    body = sub ? (
      <MemberForm key={sub} team={team} kind={kind} memberId={sub === "new" ? null : sub} />
    ) : (
      <MemberList team={team} kind={kind} />
    );
  } else {
    body = <TeamHome team={team} />;
  }

  const crumb = section ? TITLES[section] + (sub ? (sub === "new" ? "：追加" : "：編集") : "") : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <p className="event">{s.name}</p>
          <p className="uni">{uni.name}</p>
        </div>
        <nav className="tabs" aria-label="男女の切り替え">
          {(["men", "women"] as Gender[]).map((g) => (
            <a key={g} href={href(g)} className={g === gender ? "on" : ""}>
              {GENDER_LABEL[g]}チーム
            </a>
          ))}
        </nav>
      </header>
      <div className="demo-wrap">
      <div className="demo-banner">
        試作品（M1）です。入力した内容は<strong>この端末のブラウザの中だけ</strong>に保存され、ほかの人には見えません。
        <ConfirmButton
          className="btn link"
          label="最初の状態に戻す"
          question="入力した内容をすべて消して、最初のサンプルデータに戻します。"
          confirmLabel="消して戻す"
          onConfirm={async () => {
            await getStore().reset();
            go("men");
          }}
        />
      </div>
      </div>
      <main className="container">
        {crumb && (
          <nav className="crumb">
            <a href={href(gender)}>‹ トップ</a>
            {sub && <a href={href(gender, section)}>‹ {TITLES[section]}</a>}
            <h1>{crumb}</h1>
          </nav>
        )}
        {body}
      </main>
    </>
  );
}
