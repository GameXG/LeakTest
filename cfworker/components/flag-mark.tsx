"use client";

import { useEffect, useState } from "react";

let emojiSupportCache: boolean | null = null;

function flagEmoji(countryCode: string) {
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0)),
  );
}

function getCanvasData(ctx: CanvasRenderingContext2D, text: string) {
  ctx.clearRect(0, 0, 40, 24);
  ctx.fillText(text, 0, 0);
  return ctx.getImageData(0, 0, 40, 24).data;
}

function imageDiff(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff += Math.abs(a[index] - b[index]);
  }

  return diff;
}

function detectEmojiSupport() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
      return false;
    }

    ctx.textBaseline = "top";
    ctx.font =
      '18px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Segoe UI Symbol",sans-serif';

    const emojiData = getCanvasData(ctx, "🇺🇸");
    const asciiData = getCanvasData(ctx, "US");
    const tofuData = getCanvasData(ctx, "□□");

    return imageDiff(emojiData, asciiData) > 5000 && imageDiff(emojiData, tofuData) > 5000;
  } catch {
    return false;
  }
}

function getFallbackSrc(countryCode: string) {
  return countryCode.toLowerCase() === "cn"
    ? "/favicons/cn.png"
    : `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

export function FlagMark({ countryCode }: { countryCode?: string }) {
  const normalized = (countryCode ?? "").trim().toUpperCase();
  const [supportsEmoji, setSupportsEmoji] = useState<boolean | null>(emojiSupportCache);

  useEffect(() => {
    if (supportsEmoji !== null) {
      return;
    }

    const supported = detectEmojiSupport();
    emojiSupportCache = supported;
    setSupportsEmoji(supported);
  }, [supportsEmoji]);

  if (normalized.length !== 2) {
    return null;
  }

  if (supportsEmoji !== false) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          minWidth: 24,
          textAlign: "center",
          fontFamily:
            '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Segoe UI Symbol",sans-serif',
          fontSize: 18,
          lineHeight: 1,
          verticalAlign: "middle"
        }}
      >
        {flagEmoji(normalized)}
      </span>
    );
  }

  return (
    <img
      src={getFallbackSrc(normalized)}
      alt={normalized}
      style={{ width: 24, height: "auto", borderRadius: 2, verticalAlign: "middle" }}
    />
  );
}
