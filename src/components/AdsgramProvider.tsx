import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTelegram } from "./TelegramProvider";
import { recordAutoAd } from "@/lib/api.functions";

declare global {
  interface Window {
    Adsgram?: {
      init: (opts: { blockId: string }) => AdController;
    };
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
  showInterstitial: (blockId: string) => Promise<{ ok: boolean; durationSec: number; error?: string }>;
}

const AdsCtx = createContext<Ctx | null>(null);

const AUTO_INT_BLOCK = "int-30048";

function loadSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Adsgram) return resolve(true);
    const exists = document.querySelector('script[data-sad="1"]');
    if (exists) {
      const wait = setInterval(() => {
        if (window.Adsgram) { clearInterval(wait); resolve(true); }
      }, 200);
      setTimeout(() => { clearInterval(wait); resolve(!!window.Adsgram); }, 5000);
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

export function AdsgramProvider({ children }: { children: ReactNode }) {
  const tg = useTelegram();
  const recordAuto = useServerFn(recordAutoAd);
  const [ready, setReady] = useState(false);
  const controllers = useRef<Record<string, AdController>>({});

  useEffect(() => {
    loadSdk().then(setReady);
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

  const showAd = useCallback(async (blockId: string) => {
    const c = getController(blockId);
    if (!c) return { ok: false, durationSec: 0, error: "Ad SDK not loaded" };
    const startedAt = Date.now();
    try {
      const r = await c.show();
      const durationSec = Math.floor((Date.now() - startedAt) / 1000);
      if (r?.error) return { ok: false, durationSec, error: r.description || "Ad error" };
      return { ok: !!r?.done || r?.state === "load" || true, durationSec };
    } catch (e: any) {
      const durationSec = Math.floor((Date.now() - startedAt) / 1000);
      return { ok: false, durationSec, error: e?.message || "Ad failed to load" };
    }
  }, [getController]);

  // Auto interstitials: random 2-5s after open, then random 40-70s repeatedly
  useEffect(() => {
    if (!ready || !tg.ready) return;
    let cancelled = false;
    let timer: any;

    const run = async () => {
      if (cancelled) return;
      const r = await showAd(AUTO_INT_BLOCK);
      if (r.ok && r.durationSec > 0 && tg.initData) {
        try { await recordAuto({ data: { initData: tg.initData, durationSec: r.durationSec, blockId: AUTO_INT_BLOCK } }); } catch {}
      }
      const next = 40 + Math.floor(Math.random() * 31); // 40-70s
      timer = setTimeout(run, next * 1000);
    };

    const first = 2 + Math.random() * 3; // 2-5s
    timer = setTimeout(run, first * 1000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, tg.ready, tg.initData, showAd, recordAuto]);

  return (
    <AdsCtx.Provider value={{
      ready,
      showRewarded: showAd,
      showTask: showAd,
      showInterstitial: showAd,
    }}>
      {children}
    </AdsCtx.Provider>
  );
}

export function useAdsgram() {
  const c = useContext(AdsCtx);
  if (!c) throw new Error("useAdsgram must be used inside AdsgramProvider");
  return c;
}
