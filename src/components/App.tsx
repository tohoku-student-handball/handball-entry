"use client";
import { useEffect, useState, type ReactNode } from "react";
import { DemoStore } from "@/lib/demoStore";
import { LiveStore } from "@/lib/liveStore";
import { getStore, setStore, useStore } from "@/lib/store";
import { GENDER_LABEL, ROLE_LABEL, type Gender, type Role } from "@/lib/types";
import { AssetsPage } from "./AssetsPage";
import { ConfirmButton } from "./ConfirmButton";
import { Login, NotRegistered } from "./Login";
import { MemberForm } from "./MemberForm";
import { MemberList } from "./MemberList";
import { OfficeDashboard } from "./OfficeDashboard";
import { OfficeUsers } from "./OfficeUsers";
import { PrintView } from "./PrintView";
import { RegionList } from "./RegionList";
import { go, href, useRoute } from "./router";
import { SubmitPage } from "./SubmitPage";
import { TeamHome } from "./TeamHome";
import { TeamInfoForm } from "./TeamInfoForm";
import { TeamReview } from "./TeamReview";
import { UniformForm } from "./UniformForm";

const TEAM_TITLES: Record<string, string> = {
  info: "基本情報・引率責任者",
  players: "選手名簿",
  staff: "役員名簿",
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
    if (store.myMemberships().length === 0) return <NotRegistered email={store.email()} onSignOut={() => live.signOut()} />;
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
  const s = store.settings();

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
  if (!allowed || !area) return null;

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
    if (!team) {
      body = <StartTeam universityId={uniId} gender={gender} />;
    } else if (section === "info") body = <TeamInfoForm key={team.id} team={team} />;
    else if (section === "players" || section === "staff") {
      const kind = section === "players" ? "player" : "staff";
      body = sub ? <MemberForm key={sub} team={team} kind={kind} memberId={sub === "new" ? null : sub} /> : <MemberList team={team} kind={kind} />;
    } else if (section === "uniform") body = <UniformForm key={team.id} team={team} />;
    else if (section === "assets") body = <AssetsPage team={team} />;
    else if (section === "submit") body = <SubmitPage team={team} />;
    else if (section === "print") body = <PrintView team={team} />;
    else body = <TeamHome team={team} />;
    if (section && TEAM_TITLES[section]) {
      crumbs = [{ label: "トップ", to: href(gender) }];
      if (sub) crumbs.push({ label: TEAM_TITLES[section], to: href(gender, section) });
      crumbs.push({ label: TEAM_TITLES[section] + (sub ? (sub === "new" ? "：追加" : "：編集") : "") });
    }
  } else {
    const [, section, id] = route;
    const myRegion = store.myMemberships().find((m) => m.role === "region")?.regionId;
    subtitle = area === "office" ? "大会事務局" : `${store.region(myRegion ?? "")?.name ?? ""}地区学連`;
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
    } else {
      body = area === "office" ? <OfficeDashboard /> : <RegionList regionId={myRegion ?? ""} />;
    }
  }

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="topbar-row">
            <div>
              <p className="event">{s.name}</p>
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
            試作品（M2）です。入力した内容は<strong>この端末のブラウザの中だけ</strong>に保存され、ほかの人には見えません。
            上の「チーム担当者／地区学連／事務局」で、それぞれの画面を試せます。
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

function StartTeam({ universityId, gender }: { universityId: string; gender: Gender }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card center-text">
      <p>
        {store.university(universityId)?.name}の{GENDER_LABEL[gender]}チームは、まだ作成されていません。
      </p>
      <button
        className="btn primary"
        onClick={() => store.createTeam(universityId, gender).catch((e) => setError((e as Error).message))}
      >
        {GENDER_LABEL[gender]}チームの申込を始める
      </button>
      {error && <p className="msg-error">{error}</p>}
    </section>
  );
}
