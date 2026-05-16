import { createContext, useContext, useEffect, useState, ReactNode } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: any;
        ready: () => void;
        expand: () => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
        shareToStory?: (media_url: string, params?: any) => void;
        showPopup?: (params: any, cb?: (buttonId: string) => void) => void;
        HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void };
        themeParams?: any;
        colorScheme?: string;
        version?: string;
      };
    };
  }
}

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface Ctx {
  initData: string;
  user: TgUser | null;
  startParam: string | null;
  ready: boolean;
  isInTelegram: boolean;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (title: string, message: string) => void;
  haptic: (type?: "light" | "medium" | "heavy" | "success" | "error") => void;
}

const TelegramCtx = createContext<Ctx | null>(null);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({
    initData: "",
    user: null,
    startParam: null,
    ready: false,
    isInTelegram: false,
    openLink: () => {},
    openTelegramLink: () => {},
    showPopup: () => {},
    haptic: () => {},
  });

  useEffect(() => {
    // Inject Telegram WebApp script
    const load = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        try { tg.expand(); } catch {}
        const u = tg.initDataUnsafe?.user || null;
        const sp = tg.initDataUnsafe?.start_param || null;
        const initData = tg.initData || "";
        // Dev fallback: synthesize fake user when not in Telegram
        let finalUser = u;
        let finalInit = initData;
        if (!finalUser) {
          const fakeId = Number(localStorage.getItem("dev_tg_id") || "0") || Math.floor(Math.random() * 1e9);
          localStorage.setItem("dev_tg_id", String(fakeId));
          finalUser = {
            id: fakeId,
            first_name: "Dev",
            username: "dev_user_" + fakeId,
          } as any;
          const userParam = encodeURIComponent(JSON.stringify(finalUser));
          finalInit = `user=${userParam}&auth_date=${Math.floor(Date.now() / 1000)}&hash=DEV`;
        }
        setState({
          initData: finalInit,
          user: finalUser,
          startParam: sp,
          ready: true,
          isInTelegram: !!u,
          openLink: (url: string) => (tg.openLink ? tg.openLink(url) : window.open(url, "_blank")),
          openTelegramLink: (url: string) =>
            tg.openTelegramLink ? tg.openTelegramLink(url) : window.open(url, "_blank"),
          showPopup: (title: string, message: string) => {
            try {
              tg.showPopup?.({
                title,
                message,
                buttons: [{ id: "ok", type: "default", text: "OK" }],
              });
            } catch {}
          },
          haptic: (type = "light") => {
            try {
              if (type === "success" || type === "error") {
                tg.HapticFeedback?.notificationOccurred(type);
              } else {
                tg.HapticFeedback?.impactOccurred(type);
              }
            } catch {}
          },
        });
      } else {
        // Pure browser dev mode
        const fakeId = Number(localStorage.getItem("dev_tg_id") || "0") || Math.floor(Math.random() * 1e9);
        localStorage.setItem("dev_tg_id", String(fakeId));
        const fakeUser = { id: fakeId, first_name: "Dev", username: "dev_user_" + fakeId };
        const userParam = encodeURIComponent(JSON.stringify(fakeUser));
        const initData = `user=${userParam}&auth_date=${Math.floor(Date.now() / 1000)}&hash=DEV`;
        setState({
          initData,
          user: fakeUser as any,
          startParam: null,
          ready: true,
          isInTelegram: false,
          openLink: (url) => window.open(url, "_blank"),
          openTelegramLink: (url) => window.open(url, "_blank"),
          showPopup: () => {},
          haptic: () => {},
        });
      }
    };

    if (window.Telegram?.WebApp) {
      load();
    } else {
      const s = document.createElement("script");
      s.src = "https://telegram.org/js/telegram-web-app.js";
      s.async = true;
      s.onload = load;
      s.onerror = load;
      document.head.appendChild(s);
    }
  }, []);

  return <TelegramCtx.Provider value={state}>{children}</TelegramCtx.Provider>;
}

export function useTelegram() {
  const c = useContext(TelegramCtx);
  if (!c) throw new Error("useTelegram must be used inside TelegramProvider");
  return c;
}
