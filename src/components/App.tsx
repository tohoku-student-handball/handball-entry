"use client";
import { useEffect, useState, type ReactNode } from "react";
import { DemoStore } from "@/lib/demoStore";
import { LiveStore } from "@/lib/liveStore";
import { getStore, setStore, toMessage, useStore } from "@/lib/store";
import { GENDER_LABEL, ROLE_LABEL, type Gender, type Role } from "@/lib/types";
import { AssetsPage } from "./AssetsPage";
import { ConfirmButton } from "./ConfirmButton";
import { EntryPage } from "./EntryPage";
import { Login, NotRegistered } from "./Login";
import { OfficeDashboard } from "./OfficeDashboard";
import { OfficeUsers } from "./OfficeUsers";
import { PersonForm } from "./PersonForm";
import { PrintView } from "./PrintView";
import { RegionList } from "./RegionList";
import { RosterList } from "./RosterList";
import { go, href, useRoute } from "./router";
import { SubmitPage } from "./SubmitPage";
import { TeamHome } from "./TeamHome";
import { TeamInfoForm } from "./TeamInfoForm";
import { TeamReview } from "./TeamReview";
import { TournamentSettingsPage } from "./TournamentSettingsPage";
import { UniformForm } from "./UniformForm";

const TEAM_TITLES: Record<string, string> = {
  info: "基本情報",
  roster: "部員名簿（年度）",
  entry: "エントリー（この大会）",
  uniform: "ユニフォーム",
  assets: "集合写真・ロゴ",
  submit: "最終確認・提出",
  print: "申込書の印刷",
};

/** 画面全体。mode="demo" はブラウザ内保存の試作品、"live" は Supabase につなぐ本番 */
export function App({ mode }: { mode: "demo" | "live" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (mode === "demo") {
      setStore(new DemoStore());
      setReady(true);
      return;
    }
    const live = new LiveStore();
    setStore(live);
    live.init().finally(() => setReady(true));
    const { data } = live.client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") live.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [mode]);
  if (!ready) return <div className="loading">読み込み中…</div>;
  return <Root />;
}

function Root() {
  const store = useStore();
  if (store.mode === "live") {
    const live = store as LiveStore;
    if (!store.email()) return <Login store={live} />;
    if (store.tournaments().length === 0) return <NotRegistered email={store.email()} onSignOut={() => live.signOut()} />;
  }
  return <Shell />;
}

function areaOf(first: string | undefined): Role | null {
  if (first === "men" || first === "women") return "team";
  if (first === "region") return "region";
  if (first === "office") return "office";
  return null;
}

function Shell() {
  const store = useStore();
  const route = useRoute();
  const roles = store.myRoles();
  const area = areaOf(route[0]);
  const tour = store.tournament();
  const f = tour.features;

  // 開いた画面に権限がなければ、最初の役割の画面へ
  const allowed = area !== null && roles.includes(area);
  useEffect(() => {
    if (!allowed) {
      const r = roles[0];
      if (r === "team") {
        const uni = store.myMemberships().find((m) => m.role === "team")?.universityId;
        go(store.teams().find((t) => t.universityId === uni)?.gender ?? "men");
      } else if (r === "region") go("region");
      else if (r === "office") go("office");
    }
  }, [allowed, roles, store]);
  useEffect(() => {
    if (area && store instanceof DemoStore) store.actingRole = area;
  }, [area, store]);
  if (!allowed || !area) return <NoRole />;

  let body: ReactNode = null;
  let crumbs: { label: string; to?: string }[] = [];
  let subtitle = "";
  let genderTabs: Gender | null = null;

  if (area === "team") {
    const gender = route[0] as Gender;
    genderTabs = gender;
    const uniId = store.myMemberships().find((m) => m.role === "team")?.universityId ?? "";
    subtitle = store.university(uniId)?.name ?? "";
    const team = store.teams().find((t) => t.universityId === uniId && t.gender === gender);
    const [, section, sub] = route;
    if (section === "roster") {
      body = sub ? (
        <PersonForm
          key={sub}
          universityId={uniId}
          gender={gender}
          kind={sub === "new-staff" ? "staff" : store.person(sub)?.kind ?? "player"}
          personId={sub.startsWith("new-") ? null : sub}
        />
      ) : (
        <RosterList universityId={uniId} gender={gender} />
      );
    } else if (!team) {
      body = <StartTeam universityId={uniId} gender={gender} />;
    } else if (section === "info") body = <TeamInfoForm key={team.id} team={team} />;
    else if (section === "entry") body = <EntryPage key={team.id} team={team} />;
    else if (section === "uniform") body = <UniformForm key={team.id} team={team} />;
    else if (section === "assets" && f.pamphlet) body = <AssetsPage team={team} />;
    else if (section === "submit") body = <SubmitPage team={team} />;
    else if (section === "print") body = <PrintView team={team} />;
    else body = <TeamHome team={team} />;
    if (section && TEAM_TITLES[section]) {
      crumbs = [{ label: "トップ", to: href(gender) }];
      if (sub) crumbs.push({ label: TEAM_TITLES[section], to: href(gender, section) });
      crumbs.push({ label: sub ? (sub.startsWith("new-") ? "追加" : "編集") : TEAM_TITLES[section] });
    }
  } else {
    const [, section, id] = route;
    const myRegion = store.myMemberships().find((m) => m.role === "region")?.regionId;
    subtitle = area === "office" ? tour.organizer || "大会事務局" : `${store.region(myRegion ?? "")?.name ?? ""}地区学連`;
    const team = id ? store.team(id) : undefined;
    const visible = team && (area === "office" || team.regionId === myRegion);
    if (section === "team" || section === "print") {
      body = !visible ? (
        <p className="card">このチームは見つかりませんでした。</p>
      ) : section === "team" ? (
        <TeamReview team={team!} as={area as "region" | "office"} />
      ) : (
        <PrintView team={team!} />
      );
      crumbs = [{ label: "一覧", to: href(area) }];
      if (section === "print" && visible) crumbs.push({ label: "申込内容", to: href(area, "team", team!.id) });
      crumbs.push({ label: section === "team" ? "申込内容の確認" : "申込書の印刷" });
    } else if (area === "office" && section === "users") {
      body = <OfficeUsers />;
      crumbs = [{ label: "一覧", to: href("office") }, { label: "大学・担当者の登録" }];
    } else if (area === "office" && section === "settings") {
      body = <TournamentSettingsPage key={tour.id} />;
      crumbs = [{ label: "一覧", to: href("office") }, { label: "大会の設定" }];
    } else {
      body = area === "office" ? <OfficeDashboard /> : <RegionList regionId={myRegion ?? ""} />;
    }
  }

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="topbar-row">
            <div className="min0">
              <TournamentSwitcher />
              <p className="uni">{subtitle}</p>
            </div>
            {store.mode === "live" && (
              <button className="btn link on-primary" onClick={() => (getStore() as LiveStore).signOut()}>
                ログアウト
              </button>
            )}
          </div>
          {roles.length > 1 && (
            <nav className="role-switch" aria-label="役割の切り替え">
              {roles.map((r) => (
                <a key={r} href={r === "team" ? href("men") : href(r)} className={r === area ? "on" : ""}>
                  {ROLE_LABEL[r]}
                </a>
              ))}
            </nav>
          )}
        </div>
        {genderTabs && (
          <nav className="tabs" aria-label="男女の切り替え">
            {(["men", "women"] as Gender[]).map((g) => (
              <a key={g} href={href(g)} className={g === genderTabs ? "on" : ""}>
                {GENDER_LABEL[g]}チーム
              </a>
            ))}
          </nav>
        )}
      </header>
      {store instanceof DemoStore && (
        <div className="demo-wrap no-print">
          <div className="demo-banner">
            試作品（M2.5）です。入力した内容は<strong>この端末のブラウザの中だけ</strong>に保存され、ほかの人には見えません。
            上の大会名で「全日本」と「春季リーグ」を、「チーム担当者／地区学連／事務局」で役割を切り替えられます。
            <ConfirmButton
              className="btn link"
              label="最初の状態に戻す"
              question="入力した内容をすべて消して、最初のサンプルデータに戻します。"
              confirmLabel="消して戻す"
              onConfirm={async () => {
                await (store as DemoStore).reset();
                go("men");
              }}
            />
          </div>
        </div>
      )}
      <main className="container">
        {crumbs.length > 0 && (
          <nav className="crumb no-print">
            {crumbs.slice(0, -1).map((c, i) => (
              <a key={i} href={c.to}>
                ‹ {c.label}
              </a>
            ))}
            <h1>{crumbs[crumbs.length - 1].label}</h1>
          </nav>
        )}
        {body}
      </main>
    </>
  );
}

/** ヘッダーの大会名。複数の大会に関わっている人は、ここで切り替える */
function TournamentSwitcher() {
  const store = useStore();
  const list = store.tournaments();
  const cur = store.tournament();
  const [error, setError] = useState<string | null>(null);
  if (list.length <= 1) return <p className="event">{cur.name}</p>;
  return (
    <label className="tour-switch">
      <span className="sr-only">大会の切り替え</span>
      <select
        id="tournament-switch"
        value={cur.id}
        onChange={(e) => {
          setError(null);
          store
            .selectTournament(e.target.value)
            .then(() => go(""))
            .catch((err) => setError(toMessage(err)));
        }}
      >
        {list.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {error && <span className="msg-error">{error}</span>}
    </label>
  );
}

/** この大会で役割がない（別の大会だけに所属している）場合 */
function NoRole() {
  const store = useStore();
  if (store.myRoles().length > 0) return null;
  return (
    <main className="container narrow">
      <section className="card stack">
        <TournamentSwitcher />
        <p>この大会では、担当が登録されていません。上で別の大会を選んでください。</p>
      </section>
    </main>
  );
}

function StartTeam({ universityId, gender }: { universityId: string; gender: Gender }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const tu = store.tournamentUniversities().find((x) => x.universityId === universityId);
  const division = store.division(gender === "men" ? tu?.menDivisionId ?? null : tu?.womenDivisionId ?? null);
  const roster = store.roster(universityId, gender).filter((p) => p.active);
  return (
    <section className="card center-text stack">
      <p>
        {store.university(universityId)?.name}の{GENDER_LABEL[gender]}チームは、{store.tournament().shortName}にまだ申し込んでいません。
        {division && <><br />所属：<strong>{division.name}</strong></>}
      </p>
      <div>
        <button className="btn primary" onClick={() => store.createTeam(universityId, gender).catch((e) => setError(toMessage(e)))}>
          {GENDER_LABEL[gender]}チームの申込を始める
        </button>
      </div>
      {error && <p className="msg-error">{error}</p>}
      <p className="hint">
        部員名簿（{roster.length}名登録済み）は、申込を始める前でも<a href={href(gender, "roster")}>こちら</a>から入力できます。
      </p>
    </section>
  );
}
