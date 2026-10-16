// 📍 내 위치 (날씨 위젯·맛집 내 주변·내 동네 인기가 같이 쓴다). 브라우저에서만 부른다.
// Safari는 위치 확인이 느리거나(허락 창을 띄운 시간까지 timeout에 세는 판이 있다) 대략 위치를 못 잡아
// TIMEOUT·POSITION_UNAVAILABLE로 끝나는 일이 잦다 → 넉넉히 기다리고, 한 번은 정밀 위치로 다시 묻는다.
// 어떤 판은 성공도 실패도 부르지 않아서 바깥에 따로 시한을 둔다.

export type GeoErrorKind = "denied" | "unavailable" | "unsupported";
export type GeoPoint = { lat: number; lng: number };

export class GeoError extends Error {
  constructor(readonly kind: GeoErrorKind) {
    super(kind);
  }
}

const TRY_TIMEOUT_MS = 20_000;

function once(options: PositionOptions): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    let done = false;
    const guard = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new GeoError("unavailable"));
    }, (options.timeout ?? TRY_TIMEOUT_MS) + 5_000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        reject(new GeoError(err.code === 1 ? "denied" : "unavailable"));
      },
      options,
    );
  });
}

/** 지금 위치. 실패하면 GeoError (denied: 권한 꺼짐, unavailable: 못 잡음, unsupported: 위치 기능 없음) */
export async function locate(maximumAge = 5 * 60_000): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) throw new GeoError("unsupported");
  try {
    return await once({ enableHighAccuracy: false, timeout: TRY_TIMEOUT_MS, maximumAge });
  } catch (e) {
    // 권한이 없으면 다시 물어도 같다. 못 잡았을 때만 정밀 위치(GPS·Wi-Fi)로 한 번 더
    if (e instanceof GeoError && e.kind === "unavailable") return once({ enableHighAccuracy: true, timeout: TRY_TIMEOUT_MS, maximumAge: 0 });
    throw e;
  }
}

export type BrowserKind = "ios" | "mac-safari" | "other";

/** 안내 문구를 고르려고만 쓴다 (iPhone·iPad의 모든 브라우저는 Safari 엔진이라 설정 위치가 같다) */
export function browserKind(ua: string, touchPoints = 0): BrowserKind {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua)) return "mac-safari";
  return "other";
}

const DENIED: Record<BrowserKind, string> = {
  ios: "위치 권한이 꺼져 있어요. 설정 앱 → 개인정보 보호 및 보안 → 위치 서비스 → Safari 웹 사이트를 '앱을 사용하는 동안'으로 바꾸고, 주소창 왼쪽 aA → 웹 사이트 설정 → 위치를 '허용'으로 해 주세요.",
  "mac-safari": "위치 권한이 꺼져 있어요. 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스에서 Safari를 켜고, Safari 메뉴 → 설정 → 웹 사이트 → 위치에서 이 사이트를 '허용'으로 해 주세요.",
  other: "위치 권한이 꺼져 있어요. 브라우저 주소창 왼쪽 자물쇠에서 위치를 허용해 주세요.",
};

const UNAVAILABLE: Record<BrowserKind, string> = {
  ios: "위치를 찾지 못했어요. 설정 앱 → 개인정보 보호 및 보안 → 위치 서비스가 켜져 있는지 보고 다시 눌러 주세요.",
  "mac-safari": "위치를 찾지 못했어요. 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스에서 Safari가 켜져 있는지, Wi-Fi가 켜져 있는지 보고 다시 눌러 주세요.",
  other: "위치를 찾지 못했어요. 잠시 뒤 다시 눌러 주세요.",
};

/** 실패 안내 문구 (브라우저마다 설정 위치가 달라서 따로 적는다) */
export function geoErrorMessage(kind: GeoErrorKind, browser: BrowserKind): string {
  if (kind === "denied") return DENIED[browser];
  if (kind === "unavailable") return UNAVAILABLE[browser];
  return "이 브라우저는 위치를 알려 주지 않아요.";
}

/** 지금 브라우저 기준 안내 문구 */
export function geoErrorText(e: unknown): string {
  const kind = e instanceof GeoError ? e.kind : "unavailable";
  const browser = typeof navigator === "undefined" ? "other" : browserKind(navigator.userAgent, navigator.maxTouchPoints);
  return geoErrorMessage(kind, browser);
}
