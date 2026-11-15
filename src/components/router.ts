"use client";
// 試作品用のかんたんな画面切り替え（URLの # 以降で画面を決める）。
// 区切りは "--"（英数字とハイフンだけにするため）。例：#men--players, #women--staff--new

import { useSyncExternalStore } from "react";

const SEP = "--";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return hash.replace(/^#/, "").split(SEP).filter(Boolean);
}

export function href(...parts: string[]) {
  return "#" + parts.join(SEP);
}

export function go(...parts: string[]) {
  window.location.hash = href(...parts);
  window.scrollTo(0, 0);
}
