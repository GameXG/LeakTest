(() => {
  const BROWSERLEAKS_DNS_DOMAINS = ["browserleaks.net", "browserleaks.org"];
  const ROOT_SELECTOR = "[data-claude-page-root]";
  const IP_HISTORY_KEY = "claude_ip_history";
  const IP_HISTORY_MAX = 6;

  function getRoot() {
    return document.querySelector(ROOT_SELECTOR);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bindClick(id, handler) {
    const el = byId(id);
    if (!el) return () => {};
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }

  function safeHtml(id, html, isAlive) {
    if (!isAlive()) return;
    const el = byId(id);
    if (el) el.innerHTML = html;
  }

  function safeText(id, text, isAlive) {
    if (!isAlive()) return;
    const el = byId(id);
    if (el) el.textContent = text;
  }

  function getIPHistory() {
    try {
      return JSON.parse(localStorage.getItem(IP_HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function boot() {
    if (!getRoot()) return;

    if (typeof window.__destroyClaudeReplica === "function") {
      window.__destroyClaudeReplica();
    }

    let destroyed = false;
    const cleanups = [];

    const isAlive = () => !destroyed && !!getRoot();
    const previousLang = document.documentElement.lang;
    document.documentElement.lang = "zh-CN";
    cleanups.push(() => {
      document.documentElement.lang = previousLang;
    });

    const state = {
      ip: null,
      ippure: null,
      ipapis: null,
      geo: null,
      source: { main: null, security: null, cacheHit: false },
    };

    function isIPv6(ip) {
      return ip && ip.includes(":");
    }

    function truncateIP(ip) {
      if (!isIPv6(ip) || ip.length <= 20) return ip;
      return ip.substring(0, 18) + "...";
    }

    function displayIP(ip) {
      if (!ip) return "获取失败";
      if (isIPv6(ip)) {
        return `<span class="ip-truncate" title="${ip}">${truncateIP(ip)}</span>`;
      }
      return ip;
    }

    function setGeoText(elId, text) {
      const el = byId(elId);
      if (!el || !isAlive()) return;
      el.innerHTML = '<span class="geo-text"></span>';
      const span = el.firstElementChild;
      if (!span) return;
      span.textContent = text || "";
      el.classList.remove("truncated");
      el.removeAttribute("data-full");
      if (!text) return;
      requestAnimationFrame(() => {
        if (!isAlive()) return;
        if (span.scrollWidth > span.clientWidth + 1) {
          el.dataset.full = text;
          el.classList.add("truncated");
        }
      });
    }

    const handleResize = () => {
      ["ipGeoCN", "ipGeo", "ipGeoClaude", "ipGeoCodex"].forEach((id) => {
        const el = byId(id);
        const span = el && el.firstElementChild;
        if (
          !el ||
          !span ||
          !span.classList ||
          !span.classList.contains("geo-text") ||
          !span.textContent
        ) {
          return;
        }
        const truncated = span.scrollWidth > span.clientWidth + 1;
        el.classList.toggle("truncated", truncated);
        if (truncated) el.dataset.full = span.textContent;
        else el.removeAttribute("data-full");
      });
    };
    window.addEventListener("resize", handleResize);
    cleanups.push(() => window.removeEventListener("resize", handleResize));

    function showIPv6Warning() {
      const el = byId("ipv6Warn");
      if (el) el.style.display = "block";
    }

    function flagImg(cc) {
      if (!cc) return "";
      const normalized = cc.toUpperCase();
      const src = cc.toLowerCase() === "cn" ? "/favicons/cn.png" : `https://flagcdn.com/w40/${cc.toLowerCase()}.png`;
      return `<span class="flag-badge"><span class="flag-emoji" aria-hidden="true">${flagEmoji(normalized)}</span><img class="flag-fallback" src="${src}" alt="${normalized}"></span>`;
    }

    function flagEmoji(countryCode) {
      if (!countryCode || countryCode.length !== 2) return "";
      return String.fromCodePoint(
        ...countryCode
          .toUpperCase()
          .split("")
          .map((char) => 127397 + char.charCodeAt(0)),
      );
    }

    function getCanvasData(ctx, text) {
      ctx.clearRect(0, 0, 40, 24);
      ctx.fillText(text, 0, 0);
      return ctx.getImageData(0, 0, 40, 24).data;
    }

    function imageDiff(a, b) {
      let diff = 0;
      for (let i = 0; i < a.length; i += 1) {
        diff += Math.abs(a[i] - b[i]);
      }
      return diff;
    }

    function supportsFlagEmoji() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return false;
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

    async function fetchCfIP() {
      try {
        const r = await fetch("https://1.1.1.1/cdn-cgi/trace", {
          signal: AbortSignal.timeout(5000),
        });
        const txt = await r.text();
        const m = txt.match(/ip=([^\n]+)/);
        if (m) state.ip = m[1].trim();
      } catch {}
    }

    function scoreLabel(trustScore) {
      if (trustScore >= 95) return { text: "极度纯净", cls: "tag-safe" };
      if (trustScore >= 80) return { text: "纯净", cls: "tag-safe" };
      if (trustScore >= 50) return { text: "良好", cls: "tag-info" };
      if (trustScore >= 25) return { text: "中性", cls: "tag-warn" };
      return { text: "可疑", cls: "tag-danger" };
    }

    function boolTag(val, trueText, falseText) {
      if (val === true) return `<span class="tag tag-danger">${trueText || "是"}</span>`;
      if (val === false) return `<span class="tag tag-safe">${falseText || "否"}</span>`;
      return '<span class="tag tag-neutral">未知</span>';
    }

    async function fetchGeo(ip) {
      if (!ip) {
        return null;
      }

      try {
        const response = await fetch(`https://api.ipapi.is?q=${encodeURIComponent(ip)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return {
          country: data.location?.country || data.cc || "",
          region: data.location?.state || "",
          city: data.location?.city || "",
          isp: data.company?.name || data.company_name || data.asn?.org || data.asn_org || "",
          country_code: (data.location?.country_code || data.cc || "").toLowerCase(),
        };
      } catch {
        return null;
      }
    }

    async function fetchRisk(ip) {
      if (!ip) {
        return null;
      }

      try {
        const response = await fetch(`https://api.ipapi.is?q=${encodeURIComponent(ip)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        const trustScore = data.is_tor
          ? 5
          : data.is_vpn
            ? 25
            : data.is_proxy
              ? 35
              : data.is_datacenter
                ? 45
                : data.is_abuser
                  ? 30
                  : 100;
        return {
          ip: data.ip || ip,
          asn: data.asn?.asn || data.asn_num,
          asOrganization: data.asn?.org || data.asn_org || data.company?.name || data.company_name || "",
          country: data.location?.country || data.cc || "",
          countryCode: (data.location?.country_code || data.cc || "").toLowerCase(),
          region: data.location?.state || "",
          city: data.location?.city || "",
          isResidential: data.is_datacenter === false ? true : data.is_datacenter === true ? false : null,
          isBroadcast: null,
          trust_score: trustScore,
          company_type: data.company?.type || data.asn?.type || "",
          is_datacenter: data.is_datacenter,
          is_vpn: data.is_vpn,
          is_proxy: data.is_proxy,
          is_tor: data.is_tor,
          is_crawler: data.is_crawler,
          is_abuser: data.is_abuser,
          is_mobile: data.is_mobile,
        };
      } catch {
        return null;
      }
    }

    function render() {
      const p = state.ippure;
      const cr = state.claudeRisk;
      const a = state.ipapis;

      const asn = cr?.asn || p?.asn || "";
      const asnOrg = cr?.asOrganization || p?.asOrganization || a?.company?.name || "";

      const trustScore = cr?.trust_score ?? 78;
      const sl = scoreLabel(trustScore);
      const scoreColor =
        trustScore >= 95
          ? "#0a6e1e"
          : trustScore >= 80
            ? "#1b8a2d"
            : trustScore >= 50
              ? "#6fcf7c"
              : trustScore >= 25
                ? "#d4a017"
                : "#c62828";

      safeHtml(
        "gaugeScore",
        `<span style="color:${scoreColor}">${trustScore}</span> <span class="tag ${sl.cls}" style="font-size:0.5em;vertical-align:middle">${sl.text}</span>`,
        isAlive,
      );
      if (isAlive()) {
        const gaugePointer = byId("gaugePointer");
        if (gaugePointer) {
          gaugePointer.style.left = Math.min(trustScore, 100) + "%";
        }
      }
      safeText(
        "gaugeText",
        trustScore >= 95
          ? "该IP信誉极好"
          : trustScore >= 80
            ? "该 IP 信誉优异"
            : trustScore >= 50
              ? "该 IP 存在轻微风险"
              : trustScore >= 25
                ? "该 IP 存在一定风险"
                : "该 IP 风险极高",
        isAlive,
      );

      const isResidential = cr?.isResidential ?? p?.isResidential ?? (a ? !a.is_datacenter : null);
      const companyType = a?.company?.type || "";
      const regionStr = cr?.country || cr?.region || p?.country || "";
      const cityStr = cr?.city || p?.city || "";

      let propTag = "";
      if (isResidential === true) propTag = '<span class="tag tag-safe">家庭住宅IP</span>';
      else if (isResidential === false) propTag = '<span class="tag tag-warn">机房IP</span>';
      else propTag = '<span class="tag tag-neutral">未知</span>';
      if (companyType) {
        const typeMap = {
          hosting: "Hosting",
          isp: "ISP",
          business: "Business",
          education: "Education",
        };
        propTag += ` <span style="color:#8b949e;font-size:0.82em">(${typeMap[companyType] || companyType})</span>`;
      }

      safeHtml(
        "propsContent",
        `
          <div class="risk-row"><span class="risk-label">地区</span><span class="risk-value">${regionStr || "未知"}</span></div>
          <div class="risk-row"><span class="risk-label">城市</span><span class="risk-value">${cityStr || "未知"}</span></div>
          <div class="risk-row"><span class="risk-label">IP 属性</span><span class="risk-value">${propTag}</span></div>
          <div class="risk-row"><span class="risk-label">ASN</span><span class="risk-value">${asn ? `AS${asn}` : "未知"}</span></div>
          <div class="risk-row"><span class="risk-label">运营商</span><span class="risk-value" style="font-size:0.85em">${asnOrg || "未知"}</span></div>
        `,
        isAlive,
      );

      const sec = a || {};
      safeHtml(
        "securityContent",
        `
          <div class="risk-row"><span class="risk-label">VPN</span><span class="risk-value">${boolTag(sec.is_vpn, "VPN", "未检测到")}</span></div>
          <div class="risk-row"><span class="risk-label">代理 (Proxy)</span><span class="risk-value">${boolTag(sec.is_proxy, "代理", "未检测到")}</span></div>
          <div class="risk-row"><span class="risk-label">Tor</span><span class="risk-value">${boolTag(sec.is_tor, "Tor", "未检测到")}</span></div>
          <div class="risk-row"><span class="risk-label">机器人 (Crawler)</span><span class="risk-value">${boolTag(sec.is_crawler, "是", "否")}</span></div>
          <div class="risk-row"><span class="risk-label">滥用记录</span><span class="risk-value">${boolTag(sec.is_abuser, "有记录", "无记录")}</span></div>
        `,
        isAlive,
      );
    }

    async function fetchClaudeIP() {
      try {
        const r = await fetch("https://claude.ai/cdn-cgi/trace", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const text = await r.text();
        const entries = Object.fromEntries(text.trim().split("\n").map((line) => line.split("=")));
        return { ip: entries.ip || null, loc: entries.loc?.toLowerCase() || null };
      } catch {
        return null;
      }
    }

    async function fetchCodexIP() {
      try {
        const r = await fetch("https://chatgpt.com/cdn-cgi/trace", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const text = await r.text();
        const entries = Object.fromEntries(text.trim().split("\n").map((line) => line.split("=")));
        return { ip: entries.ip || null, loc: entries.loc?.toLowerCase() || null };
      } catch {
        return null;
      }
    }

    async function fetchCNIP() {
      try {
        const r = await fetch("https://2026.ip138.com/", {
          signal: AbortSignal.timeout(5000),
        });
        const html = await r.text();
        const m = html.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (m) return { ip: m[1], source: "iP138.com" };
      } catch {}

      try {
        const r = await fetch("https://my.ip.cn/", {
          signal: AbortSignal.timeout(5000),
        });
        const html = await r.text();
        const m = html.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (m) return { ip: m[1], source: "IP.cn" };
      } catch {}

      return null;
    }

    async function renderIPCard(elId, geoElId, ip, locHint) {
      if (!ip) {
        safeText(elId, "获取失败", isAlive);
        safeText(geoElId, "", isAlive);
        return;
      }

      if (isIPv6(ip)) showIPv6Warning();
      safeHtml(elId, `${locHint ? flagImg(locHint) : ""} ${displayIP(ip)}`, isAlive);

      try {
        const g = await fetchGeo(ip);
        if (g) {
          const geo = [g.country, g.region, g.city, g.isp].filter(Boolean).join(" ");
          const cc = g.country_code || locHint || "";
          safeHtml(elId, `${flagImg(cc)} ${displayIP(ip)}`, isAlive);
          setGeoText(geoElId, geo);
        }
      } catch {}
    }

    async function detectDNSLeak() {
      const el = byId("dnsLeakContent");
      if (!el) return;

      const queries = Array.from({ length: 12 }, (_, index) => {
        const randomLabel = Math.random().toString(36).slice(2, 14);
        const family = index % 2 === 0 ? "dns4" : "dns6";
        const domain = BROWSERLEAKS_DNS_DOMAINS[index % BROWSERLEAKS_DNS_DOMAINS.length];
        return `https://${randomLabel}.${family}.${domain}`;
      });

      const results = await Promise.allSettled(
        queries.map(async (url) => {
          const response = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(4000)
          });
          if (!response.ok) {
            return {};
          }
          return await response.json();
        })
      );

      const dnsServers = {};
      results.forEach((result) => {
        if (result.status !== "fulfilled" || !result.value || typeof result.value !== "object") {
          return;
        }
        Object.entries(result.value).forEach(([ip, info]) => {
          if (!dnsServers[ip]) {
            dnsServers[ip] = info;
          }
        });
      });

      if (!isAlive() || !el.isConnected) return;

      const entries = Object.entries(dnsServers);

      if (entries.length === 0) {
        el.innerHTML =
          '<div class="risk-row"><span class="risk-label">状态</span><span class="risk-value"><span class="tag tag-neutral">请使用免费第三方工具检测</span></span></div>';
        return;
      }

      const claudeCountry = (state.claudeRisk?.country || "").toLowerCase();
      const claudeInChina = claudeCountry.includes("china") || claudeCountry.includes("中国");

      let showIP = null;
      let isLeaked = false;
      for (const [ip, info] of entries) {
        const detail = Array.isArray(info) ? info : [];
        const cc = typeof detail[0] === "string" ? detail[0].toLowerCase() : "";
        const location = typeof detail[1] === "string" ? detail[1] : "";
        const isp = typeof detail[2] === "string" ? detail[2] : "";
        const isCN = cc === "cn";
        if (isCN && !claudeInChina) {
          showIP = { ip, cc, isp, location, leaked: true };
          isLeaked = true;
          break;
        }
        if (!showIP) {
          showIP = { ip, cc, isp, location, leaked: false };
        }
      }

      let rows = `<div class="risk-row"><span class="risk-label">状态</span><span class="risk-value">${
        isLeaked
          ? '<span class="tag tag-warn">可能泄露</span>'
          : '<span class="tag tag-safe">未检测到泄露</span>'
      }</span></div>`;

      if (showIP) {
        rows += `<div class="risk-row"><span class="risk-label">DNS 出口</span><span class="risk-value" style="font-size:0.85em">${flagImg(showIP.cc)} ${showIP.ip} ${showIP.leaked ? '<span class="tag tag-warn" style="font-size:0.8em">中国DNS</span>' : ""}</span></div>`;
        if (showIP.isp) {
          rows += `<div class="risk-row pc-only"><span class="risk-label">服务商</span><span class="risk-value" style="font-size:0.85em;font-weight:400;color:#8b949e">${showIP.isp}</span></div>`;
        }
        if (showIP.location) {
          rows += `<div class="risk-row pc-only"><span class="risk-label">位置</span><span class="risk-value" style="font-size:0.85em;font-weight:400;color:#8b949e">${showIP.location}</span></div>`;
        }
      }
      el.innerHTML = rows;
    }

    async function detectWebRTCLeak() {
      const el = byId("udpLeakContent");
      if (!el) return;

      const udpIPs = new Set();

      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
          ],
        });
        pc.createDataChannel("");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            pc.close();
            resolve();
          }, 5000);
          pc.onicecandidate = (e) => {
            if (!e.candidate) {
              clearTimeout(timeout);
              pc.close();
              resolve();
              return;
            }
            const ipv4 = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (ipv4) {
              const ip = ipv4[0];
              if (!ip.startsWith("0.") && !ip.startsWith("127.") && ip !== "0.0.0.0") {
                udpIPs.add(ip);
              }
            }
            const ipv6 = e.candidate.candidate.match(/([a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4}/i);
            if (ipv6) udpIPs.add(ipv6[0]);
          };
        });
      } catch {}

      const claudeIp = state.claudeRisk?.ip || "";
      const allUdp = [...udpIPs];
      const publicUdp = allUdp.filter(
        (ip) =>
          !isIPv6(ip) &&
          !ip.startsWith("192.168.") &&
          !ip.startsWith("10.") &&
          !ip.startsWith("172.") &&
          !ip.startsWith("198.18.") &&
          !ip.startsWith("198.19.") &&
          !ip.startsWith("100.64.") &&
          !ip.startsWith("127.") &&
          !ip.startsWith("0."),
      );

      if (!isAlive() || !el.isConnected) return;

      if (publicUdp.length === 0 && allUdp.length === 0) {
        el.innerHTML =
          '<div class="risk-row"><span class="risk-label">状态</span><span class="risk-value"><span class="tag tag-safe">WebRTC 已禁用或无泄露</span></span></div>';
        return;
      }

      if (publicUdp.length === 0) {
        el.innerHTML =
          '<div class="risk-row"><span class="risk-label">状态</span><span class="risk-value"><span class="tag tag-safe">未检测到泄露</span></span></div>';
        return;
      }

      const showIP = publicUdp.find((ip) => ip === claudeIp) || publicUdp[0];
      const hasMultiple = new Set(publicUdp).size > 1;
      const matchesClaude = showIP === claudeIp;
      const isLeaked = hasMultiple && !matchesClaude;

      let rows = `<div class="risk-row"><span class="risk-label">状态</span><span class="risk-value">${
        isLeaked
          ? '<span class="tag tag-warn">可能泄露</span>'
          : '<span class="tag tag-safe">未检测到泄露</span>'
      }</span></div>`;

      let showFlag = "";
      let showCountry = "";
      try {
        const g = await fetchGeo(showIP);
        if (g) {
          showFlag = g.country_code || "";
          showCountry = g.country || "";
        }
      } catch {}

      if (!isAlive() || !el.isConnected) return;

      rows += `<div class="risk-row"><span class="risk-label">UDP 出口</span><span class="risk-value" style="font-size:0.88em">${flagImg(showFlag)} ${displayIP(showIP)} ${matchesClaude ? "" : isLeaked ? '<span class="tag tag-warn" style="font-size:0.8em">异常</span>' : ""}</span></div>`;
      if (showCountry) {
        rows += `<div class="risk-row pc-only"><span class="risk-label">归属地</span><span class="risk-value" style="font-size:0.85em;font-weight:400;color:#8b949e">${showCountry}</span></div>`;
      }
      el.innerHTML = rows;
    }

    async function detectClaudeAvail() {
      const el = byId("claudeAvailContent");
      if (!el) return;

      const targets = [
        { name: "AI Web", url: "https://claude.ai/cdn-cgi/trace" },
        { name: "AI API", url: "https://www.anthropic.com/favicon.ico" },
        { name: "Codex", url: "https://chatgpt.com/cdn-cgi/trace" },
      ];

      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const start = performance.now();
          try {
            await fetch(target.url, {
              mode: "no-cors",
              signal: AbortSignal.timeout(6000),
            });
            return {
              name: target.name,
              ms: Math.round(performance.now() - start),
              ok: true,
            };
          } catch {
            return { name: target.name, ms: -1, ok: false };
          }
        }),
      );

      if (!isAlive() || !el.isConnected) return;

      let rows = "";
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const data = result.value;
        if (data.ok) {
          const cls = data.ms < 250 ? "tag-safe-dark" : data.ms < 500 ? "tag-safe" : "tag-warn";
          const label = data.ms < 250 ? "正常" : data.ms < 500 ? "良好" : "较慢";
          rows += `<div class="risk-row"><span class="risk-label">${data.name}</span><span class="risk-value"><span class="tag ${cls}">${label}</span> <span style="color:#8b949e;font-size:0.85em">${data.ms}ms</span></span></div>`;
        } else {
          rows += `<div class="risk-row"><span class="risk-label">${data.name}</span><span class="risk-value"><span class="tag tag-danger">不可访问</span></span></div>`;
        }
      });

      try {
        const statusResp = await fetch("https://status.claude.com/api/v2/summary.json", {
          signal: AbortSignal.timeout(3000),
        });
        if (statusResp.ok) {
          const st = await statusResp.json();
          const isNormal = st.status?.description === "All Systems Operational";
          const statusText = isNormal ? "全部服务正常" : "异常且不稳定";
          const statusCls = isNormal ? "tag-safe-dark" : "tag-warn";
          rows += `<div class="risk-row"><span class="risk-label">AI服务状态</span><span class="risk-value"><a href="/status/" target="_blank" rel="noopener" title="点击查看实时服务状态" style="text-decoration:none"><span class="tag ${statusCls}">${statusText}</span></a></span></div>`;
        }
      } catch {}

      if (!isAlive() || !el.isConnected) return;
      el.innerHTML = rows;
    }

    function renderDeviceInfo() {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "未知";
      const localOffset = -(new Date().getTimezoneOffset() / 60);
      const localUtc = `UTC${localOffset >= 0 ? "+" : ""}${localOffset}`;

      const cr = state.claudeRisk;
      let claudeTzStr = "";
      let tzMatch = null;
      if (cr?.country) {
        const tzMap = {
          Taiwan: [8],
          Japan: [9],
          China: [8],
          Singapore: [8],
          "United States": [-5, -6, -7, -8],
          Germany: [1, 2],
          France: [1, 2],
          Netherlands: [1, 2],
          "United Kingdom": [0, 1],
          India: [5.5],
          Brazil: [-3],
          Turkey: [3],
          Switzerland: [1, 2],
          "Hong Kong": [8],
          "South Korea": [9],
          Australia: [10, 11],
        };
        const offsets = tzMap[cr.country];
        if (offsets) {
          claudeTzStr =
            offsets.length === 1
              ? `UTC${offsets[0] >= 0 ? "+" : ""}${offsets[0]}`
              : `UTC${offsets[0] >= 0 ? "+" : ""}${offsets[0]}~UTC${offsets[offsets.length - 1] >= 0 ? "+" : ""}${offsets[offsets.length - 1]}`;
          tzMatch = offsets.some((offset) => Math.abs(offset - localOffset) < 0.5);
        }
      }

      let tzHtml = "";
      if (tzMatch === true) {
        tzHtml = `<span class="tag tag-safe">时区一致</span> ${localTz} (${localUtc})`;
      } else if (tzMatch === false) {
        tzHtml = `<span class="tag tag-warn">时区不一致</span><br><span style="font-size:0.85em">本地: ${localTz} (${localUtc})<br>出口区域: ${cr?.country || ""} (${claudeTzStr})</span>`;
      } else {
        tzHtml = `${localTz} (${localUtc})`;
      }

      const localLangs = navigator.languages || [navigator.language];
      const langsStr = localLangs.join(", ") || "未知";
      const localPrimary = (localLangs[0] || "").split("-")[0].toLowerCase();

      const langMap = {
        Taiwan: "zh",
        China: "zh",
        "Hong Kong": "zh",
        Japan: "ja",
        Singapore: "zh",
        "United States": "en",
        Germany: "de",
        France: "fr",
        Netherlands: "nl",
        India: "hi",
        Brazil: "pt",
        Turkey: "tr",
        Switzerland: "de",
        "South Korea": "ko",
        "United Kingdom": "en",
        Australia: "en",
      };
      const regionLang = cr?.country ? langMap[cr.country] || "" : "";
      const langMatch = localPrimary && regionLang ? localPrimary === regionLang : null;

      let langHtml = "";
      if (langMatch === true) {
        langHtml = `<span class="tag tag-safe">语言一致</span> ${langsStr}`;
      } else if (langMatch === false) {
        langHtml = `<span class="tag tag-warn">语言不一致</span><br><span style="font-size:0.85em">本地: ${langsStr}<br>出口所在地常用语言: ${regionLang}</span>`;
      } else {
        langHtml = langsStr;
      }

      const ua = navigator.userAgent;
      let os = "未知";
      let browser = "未知";
      if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Mac OS")) os = "macOS";
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("Linux")) os = "Linux";
      if (ua.includes("Edg/")) browser = `Edge ${(ua.match(/Edg\/([\d.]+)/) || [])[1]}`;
      else if (ua.includes("Chrome/")) browser = `Chrome ${(ua.match(/Chrome\/([\d.]+)/) || [])[1]}`;
      else if (ua.includes("Firefox/")) browser = `Firefox ${(ua.match(/Firefox\/([\d.]+)/) || [])[1]}`;
      else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
        browser = `Safari ${(ua.match(/Version\/([\d.]+)/) || [])[1]}`;
      }

      let webglRenderer = "不支持";
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) webglRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        }
      } catch {}

      let webglHash = "不支持";
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "";
          const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
          const str = `${vendor}~${renderer}~${gl.getParameter(gl.VERSION)}~${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`;
          let hash = 0;
          for (let i = 0; i < str.length; i += 1) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
          }
          webglHash = (hash >>> 0).toString(16).toUpperCase();
        }
      } catch {}

      let canvasHash = "不支持";
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(50, 0, 100, 50);
        ctx.fillStyle = "#069";
        ctx.fillText("ai risk", 2, 15);
        ctx.fillStyle = "rgba(102,204,0,0.7)";
        ctx.fillText("canvas fp", 4, 30);
        const data = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < data.length; i += 1) {
          hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
        }
        canvasHash = (hash >>> 0).toString(16).toUpperCase();
      } catch {}

      safeHtml(
        "deviceContent",
        `
          <div class="risk-row"><span class="risk-label">时区</span><span class="risk-value">${tzHtml}</span></div>
          <div class="risk-row"><span class="risk-label">语言</span><span class="risk-value" style="font-size:0.85em">${langHtml}</span></div>
          <div class="risk-row"><span class="risk-label">操作系统 / 浏览器</span><span class="risk-value">${os} / ${browser}</span></div>
          <div class="risk-row"><span class="risk-label">Cookie</span><span class="risk-value">${navigator.cookieEnabled ? '<span class="tag tag-safe">已启用</span>' : '<span class="tag tag-warn">已禁用</span>'}</span></div>
          <div class="risk-row"><span class="risk-label">WebGL 渲染器</span><span class="risk-value dev-long">${webglRenderer}</span></div>
          <div class="risk-row"><span class="risk-label">Canvas 指纹</span><span class="risk-value" style="letter-spacing:1px">${canvasHash}</span></div>
          <div class="risk-row"><span class="risk-label">WebGL 指纹</span><span class="risk-value" style="letter-spacing:1px">${webglHash}</span></div>
        `,
        isAlive,
      );
    }

    function renderIPHistory() {
      const el = byId("ipHistoryContent");
      if (!el || !isAlive()) return;

      const history = getIPHistory();

      if (history.length === 0) {
        el.textContent = "暂无历史记录";
        return;
      }

      el.innerHTML = history
        .map((h, index) => {
          const d = new Date(h.time);
          const timeStr = `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          const isCurrent = index === 0;
          return `<div class="risk-row" style="padding:6px 0">
            <span class="risk-label" style="color:${isCurrent ? "#1a1a1a" : "#8b949e"};font-size:0.88em">${timeStr}${isCurrent ? ' <span style="color:#1b8a2d;font-size:0.82em">(当前)</span>' : ""}</span>
            <span class="risk-value" style="font-size:0.88em">${flagImg(h.cc)} ${displayIP(h.ip)} <span style="color:#8b949e;font-size:0.85em">${h.geo}</span></span>
          </div>`;
        })
        .join("");
    }

    function saveAndRenderIPHistory() {
      const claudeIp = state.claudeRisk?.ip || "";
      const claudeCC = (state.claudeRisk?.countryCode || "").toLowerCase();
      const claudeGeo = state.claudeRisk?.city || "";

      if (!claudeIp) {
        renderIPHistory();
        return;
      }

      const history = getIPHistory();
      const now = new Date();
      const entry = {
        ip: claudeIp,
        cc: claudeCC,
        geo: claudeGeo,
        time: now.toISOString(),
      };

      if (history.length > 0) {
        const lastEntry = history[0];
        const lastTime = new Date(lastEntry.time);
        const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

        if (lastEntry.ip === claudeIp && hoursSinceLast < 24) {
          renderIPHistory();
          return;
        }
      }

      history.unshift(entry);
      if (history.length > IP_HISTORY_MAX) history.length = IP_HISTORY_MAX;
      localStorage.setItem(IP_HISTORY_KEY, JSON.stringify(history));
      renderIPHistory();
    }

    function clearIPHistory() {
      localStorage.removeItem(IP_HISTORY_KEY);
      renderIPHistory();
    }

    async function main() {
      document.documentElement.classList.toggle("flag-emoji-fallback", !supportsFlagEmoji());

      const [cnResult, claudeResult, codexResult] = await Promise.allSettled([
        fetchCNIP(),
        fetchClaudeIP(),
        fetchCodexIP(),
      ]);
      await fetchCfIP();

      const cn = cnResult.status === "fulfilled" ? cnResult.value : null;
      const claude = claudeResult.status === "fulfilled" ? claudeResult.value : null;
      const codex = codexResult.status === "fulfilled" ? codexResult.value : null;

      const tasks = [];

      tasks.push(renderIPCard("ipAddrCN", "ipGeoCN", cn?.ip, "cn"));
      tasks.push(renderIPCard("ipAddrCodex", "ipGeoCodex", codex?.ip, codex?.loc));

      tasks.push(
        (async () => {
          if (!state.ip) {
            safeText("ipAddr", "获取失败", isAlive);
            safeText("ipGeo", "", isAlive);
            return;
          }
          if (isIPv6(state.ip)) showIPv6Warning();
          safeHtml("ipAddr", displayIP(state.ip), isAlive);
          try {
            const g = await fetchGeo(state.ip);
            if (g) {
              const cc = (g.country_code || "").toLowerCase();
              state.ippure = {
                ip: state.ip,
                country: g.country,
                countryCode: (g.country_code || "").toUpperCase(),
                region: g.region,
                city: g.city,
              };
              state.cfGeo = [g.country, g.region, g.city, g.isp].filter(Boolean).join(" ");
              safeHtml("ipAddr", `${flagImg(cc)} ${displayIP(state.ip)}`, isAlive);
              setGeoText("ipGeo", state.cfGeo);
            }
          } catch {}
        })(),
      );

      tasks.push(
        (async () => {
          const claudeIp = claude?.ip;
          if (!claudeIp) {
            safeText("ipAddrClaude", "获取失败", isAlive);
            safeText("ipGeoClaude", "", isAlive);
            return;
          }
          if (isIPv6(claudeIp)) showIPv6Warning();
          safeHtml("ipAddrClaude", `${flagImg(claude.loc || "")} ${displayIP(claudeIp)}`, isAlive);

          const [riskResp, geoResp] = await Promise.allSettled([
            fetchRisk(claudeIp),
            fetchGeo(claudeIp),
          ]);

          let claudeGeoOk = false;
          if (geoResp.status === "fulfilled" && geoResp.value) {
            try {
              const g = geoResp.value;
              if (g.country) {
                const geo = [g.country, g.region, g.city, g.isp].filter(Boolean).join(" ");
                safeHtml("ipAddrClaude", `${flagImg(g.country_code || claude.loc || "")} ${displayIP(claudeIp)}`, isAlive);
                setGeoText("ipGeoClaude", geo);
                claudeGeoOk = true;
              }
            } catch {}
          }

          if (!claudeGeoOk && claude.loc) {
            const locMap = {
              jp: "Japan",
              tw: "Taiwan",
              hk: "Hong Kong",
              sg: "Singapore",
              us: "United States",
              de: "Germany",
              kr: "South Korea",
              fr: "France",
              nl: "Netherlands",
              gb: "United Kingdom",
              au: "Australia",
              ca: "Canada",
              br: "Brazil",
              in: "India",
            };
            safeHtml("ipAddrClaude", `${flagImg(claude.loc)} ${displayIP(claudeIp)}`, isAlive);
            setGeoText("ipGeoClaude", locMap[claude.loc] || claude.loc.toUpperCase());
          }

          if (riskResp.status === "fulfilled" && riskResp.value) {
            const d = riskResp.value;
            state.ipapis = {
              is_datacenter: d.is_datacenter,
              is_vpn: d.is_vpn,
              is_proxy: d.is_proxy,
              is_tor: d.is_tor,
              is_crawler: d.is_crawler,
              is_abuser: d.is_abuser,
              is_mobile: d.is_mobile,
              company: { type: d.company_type, name: d.company_name },
              abuser_score: d.abuser_score,
              datacenter_name: d.datacenter_name,
            };
            state.claudeRisk = {
              ip: claudeIp,
              asn: d.asn,
              asOrganization: d.asOrganization,
              country: d.country,
              countryCode: d.countryCode,
              region: d.region,
              city: d.city,
              isResidential: d.isResidential,
              isBroadcast: d.isBroadcast,
              trust_score: d.trust_score,
            };
          }
        })(),
      );

      await Promise.allSettled(tasks);
      if (!isAlive()) return;

      render();
      Promise.allSettled([detectDNSLeak(), detectWebRTCLeak(), detectClaudeAvail()]);
      renderDeviceInfo();
      saveAndRenderIPHistory();
    }

    cleanups.push(
      bindClick("claude-refresh-button", () => {
        void detectClaudeAvail();
      }),
    );
    cleanups.push(bindClick("claude-clear-history", clearIPHistory));

    main().catch(() => {});

    window.__destroyClaudeReplica = () => {
      destroyed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }

  window.__bootClaudeReplica = boot;
})();
