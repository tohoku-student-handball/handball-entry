"use client";
import { useState } from "react";
import { useStore, type TournamentPatch } from "@/lib/store";
import { FEATURE_LABEL, TOURNAMENT_KIND_LABEL, type Features } from "@/lib/types";
import { Field } from "./Field";
import { go } from "./router";
import { ActionButton } from "./ui";

const LIMIT_LABEL: Record<keyof TournamentPatch["limits"], string> = {
  playerEntryMax: "エントリー選手の上限",
  staffMax: "役員の上限",
  benchPlayerMax: "ベンチ登録（選手）の上限",
  benchStaffMax: "ベンチ登録（役員）の上限",
  foreignEntryMax: "留学生エントリーの上限",
  foreignGameEntryMax: "留学生ゲームエントリーの上限",
  numberMin: "背番号の最小",
  numberMax: "背番号の最大",
};
const FEE_LABEL: Record<keyof TournamentPatch["fees"], string> = {
  entry: "参加料（1チーム・円）",
  insurancePerPerson: "傷害保険料（1名・円）",
  sponsorUniform: "協賛企業名入りユニフォーム（1着種・円）",
};

/** 日本時間の "YYYY-MM-DDTHH:mm"（日時入力欄用） */
function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** A-2 大会の設定（主催者が画面から変更。プログラムの変更は不要） */
export function TournamentSettingsPage() {
  const store = useStore();
  const tour = store.tournament();
  const s = store.settings();
  const [p, setP] = useState<TournamentPatch>({
    name: tour.name,
    shortName: tour.shortName,
    startDate: s.startDate,
    entryDeadlineAt: s.entryDeadlineAt,
    limits: { ...s.limits },
    fees: { ...s.fees },
    features: { ...tour.features },
  });
  const [deadline, setDeadline] = useState(toLocalInput(s.entryDeadlineAt));
  const [saved, setSaved] = useState(false);
  const setLimit = (k: keyof TournamentPatch["limits"], v: string) => setP({ ...p, limits: { ...p.limits, [k]: Number(v) } });
  const setFee = (k: keyof TournamentPatch["fees"], v: string) => setP({ ...p, fees: { ...p.fees, [k]: Number(v) } });
  const setFeature = (k: keyof Features, v: boolean) => setP({ ...p, features: { ...p.features, [k]: v } });

  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <section className="card">
        <p className="muted small">
          種類：{TOURNAMENT_KIND_LABEL[tour.kind]}／{tour.academicYear}年度／承認：{tour.reviewFlow === "one_step" ? "主催者のみ（1段階）" : "地区学連 → 事務局（2段階）"}
        </p>
        <Field label="大会名">
          <input id="set-name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Field>
        <Field label="短い名前（画面の切り替えなどに表示）">
          <input id="set-short" value={p.shortName} onChange={(e) => setP({ ...p, shortName: e.target.value })} />
        </Field>
        <div className="grid2 stack-phone">
          <Field label="大会初日（未成年の判定に使う）">
            <input id="set-start" type="date" value={p.startDate} onChange={(e) => setP({ ...p, startDate: e.target.value })} />
          </Field>
          <Field label="申込締切（日本時間）" hint="この日時を過ぎると、チームは名簿やエントリーを変更できなくなります。">
            <input id="set-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>人数の上限</h3>
        <div className="grid2">
          {(Object.keys(LIMIT_LABEL) as (keyof TournamentPatch["limits"])[]).map((k) => (
            <Field key={k} label={LIMIT_LABEL[k]}>
              <input id={`set-limit-${k}`} type="number" inputMode="numeric" value={p.limits[k]} onChange={(e) => setLimit(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>金額</h3>
        <div className="grid2">
          {(Object.keys(FEE_LABEL) as (keyof TournamentPatch["fees"])[]).map((k) => (
            <Field key={k} label={FEE_LABEL[k]}>
              <input id={`set-fee-${k}`} type="number" inputMode="numeric" value={p.fees[k]} onChange={(e) => setFee(k, e.target.value)} />
            </Field>
          ))}
        </div>
        {store.divisions().length > 0 && <p className="hint">部ごとに参加料を変える設定は、M3（入金管理）で追加します。</p>}
      </section>

      <section className="card">
        <h3>この大会で使う機能</h3>
        {(Object.keys(FEATURE_LABEL) as (keyof Features)[]).map((k) => (
          <label key={k} className="check">
            <input type="checkbox" checked={p.features[k]} onChange={(e) => setFeature(k, e.target.checked)} />
            <span>{FEATURE_LABEL[k]}</span>
          </label>
        ))}
        <p className="hint">オフにした機能は、チームの画面に表示されず、入力も必須でなくなります。</p>
      </section>

      {saved && <p className="ok-box">保存しました。</p>}
      <div className="actions sticky">
        <button type="button" className="btn" onClick={() => go("office")}>
          戻る
        </button>
        <ActionButton
          onClick={async () => {
            setSaved(false);
            if (!deadline) throw new Error("申込締切を入力してください。");
            await store.saveTournament({ ...p, entryDeadlineAt: `${deadline}:00+09:00` });
            setSaved(true);
          }}
          busyLabel="保存中…"
        >
          保存する
        </ActionButton>
      </div>
    </form>
  );
}
