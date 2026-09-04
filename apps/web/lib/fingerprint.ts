import type { FingerprintPayload } from "./api";

type UaDataBrand = { brand: string; version: string };

type MaybeNavigatorWithUAData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
    brands?: UaDataBrand[];
  };
};

export function collectBasicFingerprint(sessionId: string, token: string): FingerprintPayload {
  const maybeNavigator = navigator as MaybeNavigatorWithUAData;
  const userAgentData = maybeNavigator.userAgentData;
  const languages = [...(navigator.languages || [navigator.language])];

  return {
    sessionId,
    token,
    ua: navigator.userAgent,
    uaCh: {
      mobile: userAgentData?.mobile,
      platform: userAgentData?.platform,
      brands: userAgentData?.brands
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    utcOffsetMinutes: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages,
    acceptLanguage: languages.join(","),
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      pixelRatio: window.devicePixelRatio || 1
    },
    deviceSignals: {
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints
    }
  };
}
