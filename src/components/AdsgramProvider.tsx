import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTelegram } from "./TelegramProvider";
import { recordAutoAd } from "@/lib/api.functions";

declare global {
  interface Window {
    Adsgram?: {
      init: (opts: { blockId: string }) => AdController;
    };
    show_11012677?: (opts?: any) => Promise<any>;
  }

  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "data-block-id"?: string;
        "data-debug"?: string;
        "data-debug-console"?: string;
      };
    }
  }
}

interface AdController {
  show: () => Promise<{ done: boolean; description?: string; state?: string; error?: boolean }>;
  destroy?: () => void;
  addEventListener?: (e: string, cb: any) => void;
}

interface Ctx {
  ready: boolean;
  showRewarded: (blockId: string) => Promise<{ ok: boolean; durationSec: number; error?: string }>;
  showTask: (blockId: string) => Promise<{ ok: boolean; durationSec: number; error?: string }>;
  showInterstitial: (
    blockId: string,
  ) => Promise<{ ok: boolean; durationSec: number; error?: string }>;
  openMonetagReward: (requestVar?: string) => Promise<{ ok: boolean; rewardGranted: boolean; error?: string }>;
  taskReady: boolean;
  taskBlockId: string;
}

const AdsCtx = createContext<Ctx | null>(null);

const AUTO_INT_BLOCK = "int-30048";
const MONETAG_ZONE = "11012677";
const MONETAG_FN = "show_11012677";

type AdKind = "interstitial" | "rewarded" | "task";

function getAdCandidates(rawBlockId: string, kind: AdKind) {
  const raw = String(rawBlockId || "").trim();
  const digits = raw.replace(/\D+/g, "");
  const list = new Set<string>();

  if (kind === "interstitial") {
    if (/^int-\d+$/i.test(raw)) list.add(raw.toLowerCase());
    if (digits) {
      list.add(`int-${digits}`);
      list.add(digits);
    }
  } else if (kind === "task") {
    if (/^task-\d+$/i.test(raw)) list.add(raw.toLowerCase());
    if (digits) {
      list.add(`task-${digits}`);
      list.add(digits);
    }
  } else {
    if (/^\d+$/.test(raw)) list.add(raw);
    if (digits) list.add(digits);
  }

  return [...list].filter(Boolean);
}

function loadSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Adsgram) return resolve(true);
    const exists = document.querySelector('script[data-sad="1"]');
    if (exists) {
      const wait = setInterval(() => {
        if (window.Adsgram) {
          clearInterval(wait);
          resolve(true);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(wait);
        resolve(!!window.Adsgram);
      }, 5000);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sad.adsgram.ai/js/sad.min.js";
    s.async = true;
    s.dataset.sad = "1";
    s.onload = () => resolve(!!window.Adsgram);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function loadMonetagSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (typeof window[MONETAG_FN as keyof Window] === "function") return resolve(true);
    const exists = document.querySelector(`script[data-sdk='${MONETAG_FN}']`);
    if (exists) {
      const wait = setInterval(() => {
        if (typeof window[MONETAG_FN as keyof Window] === "function") {
          clearInterval(wait);
          resolve(true);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(wait);
        resolve(typeof window[MONETAG_FN as keyof Window] === "function");
      }, 5000);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://libtl.com/sdk.js";
    s.async = true;
    s.dataset.zone = MONETAG_ZONE;
    s.dataset.sdk = MONETAG_FN;
    s.onload = () => resolve(typeof window[MONETAG_FN as keyof Window] === "function");
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function loadTaskElement(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.customElements?.get("adsgram-task")) return resolve(true);
    const exists = document.querySelector('script[data-adsgram-task="1"]');
    if (exists) {
      const wait = setInterval(() => {
        if (window.customElements?.get("adsgram-task")) {
          clearInterval(wait);
          resolve(true);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(wait);
        resolve(!!window.customElements?.get("adsgram-task"));
      }, 5000);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sad.adsgram.ai/js/adsgram-task.js";
    s.async = true;
    s.dataset.adsgramTask = "1";
    s.onload = () => resolve(!!window.customElements?.get("adsgram-task"));
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function AdsgramProvider({ children }: { children: ReactNode }) {
  const tg = useTelegram();
  const recordAuto = useServerFn(recordAutoAd);
  const [ready, setReady] = useState(false);
  const [taskReady, setTaskReady] = useState(false);
  const controllers = useRef<Record<string, AdController>>({});
  const taskBlockId = useMemo(() => "task-30049", []);

  useEffect(() => {
    loadSdk().then(setReady);
    loadTaskElement().then(setTaskReady);
    loadMonetagSdk();
  }, []);

  const getController = useCallback((blockId: string): AdController | null => {
    if (!window.Adsgram) return null;
    if (!controllers.current[blockId]) {
      try {
        controllers.current[blockId] = window.Adsgram.init({ blockId });
      } catch {
        return null;
      }
    }
    return controllers.current[blockId];
  }, []);

  const showAd = useCallback(
    async (blockId: string, kind: AdKind) => {
      const candidates = getAdCandidates(blockId, kind);
      if (!candidates.length)
        return { ok: false, durationSec: 0, error: "Ad block is not configured" };

      if (!tg.isInTelegram) {
        return {
          ok: false,
          durationSec: 0,
          error: "Open this mini app inside Telegram to watch ads.",
        };
      }

      if (kind === "task") {
        return {
          ok: false,
          durationSec: 0,
          error: "Use the task card below to complete the ad task.",
        };
      }

      let lastError = "Ad failed to load";

      for (const candidate of candidates) {
        const c = getController(candidate);
        if (!c) {
          lastError = "Ad SDK not loaded";
          continue;
        }

        const startedAt = Date.now();
        try {
          const r = await c.show();
          const durationSec = Math.floor((Date.now() - startedAt) / 1000);
          if (r?.error) {
            lastError = r.description || "Ad error";
            continue;
          }
          const ok = r?.done === true || r?.state === "load" || r?.state === "completed";
          if (!ok) {
            lastError = r?.description || "Ad was closed too early";
            continue;
          }
          return { ok: true, durationSec };
        } catch (e: any) {
          lastError = e?.message || "Ad failed to load";
        }
      }

      return { ok: false, durationSec: 0, error: lastError };
    },
    [getController, tg.isInTelegram],
  );

  const openMonetagReward = useCallback(async (requestVar?: string) => {
    if (typeof window === "undefined") {
      return { ok: false, rewardGranted: false, error: "Not available here" };
    }
    const loaded = await loadMonetagSdk();
    if (!loaded || typeof window.show_11012677 !== "function") {
      return { ok: false, rewardGranted: false, error: "Reward ad failed to load" };
    }
    try {
      const result = await window.show_11012677({
        type: "end",
        requestVar: requestVar || "reward_flow",
      });
      const rewardGranted = result?.reward_event_type === "valued" || result?.status === "success";
      return { ok: true, rewardGranted };
    } catch (e: any) {
      return { ok: false, rewardGranted: false, error: e?.message || "Reward ad failed to open" };
    }
  }, []);

  // Auto interstitials: random 2-5s after open, then random 40-70s repeatedly
  useEffect(() => {
    if (!ready || !tg.ready) return;
    let cancelled = false;
    let timer: any;

    const run = async () => {
      if (cancelled) return;
      const r = await showAd(AUTO_INT_BLOCK, "interstitial");
      if (r.ok && r.durationSec > 0 && tg.initData) {
        try {
          await recordAuto({
            data: { initData: tg.initData, durationSec: r.durationSec, blockId: AUTO_INT_BLOCK },
          });
        } catch {}
      }
      const next = 40 + Math.floor(Math.random() * 31); // 40-70s
      timer = setTimeout(run, next * 1000);
    };

    const first = 2 + Math.random() * 3; // 2-5s
    timer = setTimeout(run, first * 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, tg.ready, tg.initData, showAd, recordAuto]);

  return (
    <AdsCtx.Provider
      value={{
        ready,
        showRewarded: (blockId) => showAd(blockId, "rewarded"),
        showTask: (blockId) => showAd(blockId, "task"),
        showInterstitial: (blockId) => showAd(blockId, "interstitial"),
        openMonetagReward,
        taskReady,
        taskBlockId,
      }}
    >
      {children}
    </AdsCtx.Provider>
  );
}

export function useAdsgram() {
  const c = useContext(AdsCtx);
  if (!c) throw new Error("useAdsgram must be used inside AdsgramProvider");
  return c;
}
