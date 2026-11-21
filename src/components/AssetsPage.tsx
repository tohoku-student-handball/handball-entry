"use client";
import { useStore } from "@/lib/store";
import { ASSET_LABEL, type AssetKind, type Team } from "@/lib/types";
import { lockReason } from "@/lib/validation";
import { PhotoInput } from "./PhotoInput";
import { LockBanner } from "./ui";

/** T-5 集合写真・ロゴ */
export function AssetsPage({ team }: { team: Team }) {
  const store = useStore();
  const s = store.settings();
  const locked = lockReason(team, s);
  const assets = store.assets(team.id);
  const rules: Record<AssetKind, typeof s.images.group> = { group: s.images.group, logo: s.images.logo };
  const hints: Record<AssetKind, string> = {
    group: "パンフレットのチーム紹介ページに載せる写真です。横長で、全員の顔がはっきり写っているものを選んでください。",
    logo: "チーム紹介ページに載せるロゴです。背景が白または透明のものがきれいに印刷されます。",
  };

  return (
    <div className="stack">
      <LockBanner reason={locked} />
      {(["group", "logo"] as AssetKind[]).map((kind) => {
        const a = assets.find((x) => x.kind === kind);
        return (
          <section key={kind} className="card">
            <h3>{ASSET_LABEL[kind]}</h3>
            <p className="hint">{hints[kind]}</p>
            <PhotoInput
              value={a?.path ?? null}
              rule={rules[kind]}
              wide={kind === "group"}
              disabled={!!locked}
              onSave={(blob, w, h) => store.setAsset(team.id, kind, blob, w, h)}
              onRemove={() => store.removeAsset(team.id, kind)}
            />
          </section>
        );
      })}
    </div>
  );
}
