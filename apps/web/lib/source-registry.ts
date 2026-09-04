export const SOURCE_REGISTRY = {
  ip: {
    mainlandIpv4Pages: ["https://2026.ip138.com/", "https://my.ip.cn/"],
    publicIp: {
      ipv4: {
        json: ["https://api4.ipify.org?format=json"],
        text: ["https://ipv4.icanhazip.com"]
      },
      ipv6: {
        json: ["https://api6.ipify.org?format=json"],
        text: ["https://ipv6.icanhazip.com"]
      }
    },
    providers: [
      {
        id: "ipapi-is",
        label: "ipapi.is",
        note: "浏览器直连稳定；免费响应提供国家、ASN、运营商和风险标签。",
        lookupKey: "ipapiIs"
      },
      {
        id: "ipapi-co",
        label: "ipapi.co",
        note: "官方文档明确支持前端接入，适合做位置和时区交叉校验。",
        lookupKey: "ipapiCo"
      },
      {
        id: "freeipapi",
        label: "FreeIPAPI",
        note: "官方免费服务器支持免认证查询，适合补时区和 ASN 组织。",
        lookupKey: "freeIpApi"
      },
      {
        id: "ip-sb",
        label: "ip.sb",
        note: "官方明确支持 CORS，适合校验当前出口位置和运营商。",
        lookupKey: "ipSb"
      },
      {
        id: "geojs",
        label: "GeoJS",
        note: "官方文档提供 HTTPS + CORS Geo 接口，可补充时区和 ASN 组织。",
        lookupKey: "geoJs"
      },
      {
        id: "ipquery-io",
        label: "ipquery.io",
        note: "官方文档提供免费层和 risk scoring，适合作为交叉验证卡。",
        lookupKey: "ipQuery"
      },
      {
        id: "ip-api-com",
        label: "ip-api.com",
        note: "免费版仅支持 HTTP，本地测试环境下可补充主机、代理和移动网络判断。",
        lookupKey: "ipApi",
        httpOnly: true
      }
    ]
  },
  dns: {
    leakDomains: ["browserleaks.net", "browserleaks.org"]
  },
  environment: {
    regionalPortals: {
      cn: ["https://www.gov.cn/", "https://www.edu.cn/"],
      hk: ["https://www.gov.hk/", "https://www.hku.hk/"],
      sg: ["https://www.gov.sg/", "https://www.nus.edu.sg/"],
      jp: ["https://www.japan.go.jp/", "https://www.u-tokyo.ac.jp/"],
      uk: ["https://www.gov.uk/", "https://www.cam.ac.uk/"],
      us: ["https://www.usa.gov/", "https://www.ed.gov/"]
    }
  },
  webrtc: {
    stunServers: [
      "stun:stun.miwifi.com",
      "stun:39.107.142.158",
      "stun:stun.qq.com",
      "stun:stun.douyucdn.cn",
      "stun:stun1.douyucdn.cn",
      "stun:stun.hitv.com",
      "stun:stun.sipgate.net",
      "stun:stun.ekiga.net",
      "stun:stun.freeswitch.org",
      "stun:stun.linphone.org",
      "stun:stun.voipbuster.com",
      "stun:stun.voipstunt.com",
      "stun:stun.easybell.de",
      "stun:stun.callwithus.com",
      "stun:stun.counterpath.com",
      "stun:stun.internetcalls.com",
      "stun:stun.voxgratia.org",
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.nextcloud.com",
      "stun:stun.nextcloud.com:443",
      "stun:stunserver.stunprotocol.org",
      "stun:global.stun.twilio.com:3478",
      "stun:jp1.stun.twilio.com:3478",
      "stun:sg1.stun.twilio.com:3478",
      "stun:us1.stun.twilio.com:3478",
      "stun:us2.stun.twilio.com:3478",
      "stun:stun.cloudflare.com:3478"
    ]
  },
  routing: {
    publicProbes: [
      {
        id: "ipify",
        label: "基础出口",
        endpoint: "https://api64.ipify.org?format=json"
      },
      {
        id: "ip-sb",
        label: "地理出口",
        endpoint: "https://api.ip.sb/geoip"
      },
      {
        id: "ipapi-co",
        label: "运营商出口",
        endpoint: "https://ipapi.co/json/"
      }
    ],
    traceProbes: [
      {
        id: "cf-1dot1",
        label: "Cloudflare 公共入口",
        endpoint: "https://1.1.1.1/cdn-cgi/trace"
      },
      {
        id: "cf-www",
        label: "Cloudflare 主站",
        endpoint: "https://www.cloudflare.com/cdn-cgi/trace"
      },
      {
        id: "cf-claude",
        label: "Claude 站点",
        endpoint: "https://claude.ai/cdn-cgi/trace"
      },
      {
        id: "cf-codex",
        label: "ChatGPT 站点",
        endpoint: "https://chatgpt.com/cdn-cgi/trace"
      },
      {
        id: "cf-openai",
        label: "OpenAI 站点",
        endpoint: "https://openai.com/cdn-cgi/trace"
      },
      {
        id: "cf-cdnjs",
        label: "Cloudflare 静态资源",
        endpoint: "https://cdnjs.cloudflare.com/cdn-cgi/trace"
      }
    ]
  },
  officialStatus: {
    claude: {
      pageUrl: "https://status.claude.com",
      apiUrl: "https://status.claude.com/api/v2/summary.json"
    },
    openai: {
      pageUrl: "https://status.openai.com/",
      apiUrl: "https://status.openai.com/api/v2/summary.json"
    },
    google: {
      pageUrl: "https://www.google.com/appsstatus/dashboard/",
      incidentsUrl: "https://www.google.com/appsstatus/dashboard/incidents.json"
    },
    apple: {
      pageUrl: "https://www.apple.com/support/systemstatus/",
      apiUrl: "https://www.apple.com/support/systemstatus/data/system_status_en_US.js"
    }
  }
} as const;
