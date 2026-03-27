/**
 * A Cloudflare Worker for proxying Microsoft Edge's TTS service with embedded WebUI.
 *
 * @version 1.0
 * @description Edge TTS proxy service with embedded WebUI, OpenAI-compatible API, history storage, and sharing.
 */

// =================================================================================
// Configuration & Global State
// =================================================================================

// Environment variables will be accessed directly from globalThis when needed
const MAX_STORAGE_SIZE = 1024 * 1024 * 1024; // 1GB limit
const SITE_NAME = "字音驿站";
const OPENAI_VOICE_MAP = {
  shimmer: "zh-CN-XiaoxiaoNeural",
  alloy: "zh-CN-YunyangNeural",
  fable: "zh-CN-YunjianNeural",
  onyx: "zh-CN-XiaoyiNeural",
  nova: "zh-CN-YunxiNeural",
  echo: "zh-CN-liaoning-XiaobeiNeural",
};

// 多语言音色目录（供 WebUI 分组下拉框使用）
const VOICE_CATALOG = {
  "🇨🇳 中文": [
    { name: "zh-CN-XiaoxiaoNeural",        label: "晓晓 - 温柔女声",   preview: "你好，我是晓晓，很高兴认识你。" },
    { name: "zh-CN-XiaoyiNeural",          label: "晓伊 - 活泼女声",   preview: "你好，我是晓伊，很高兴认识你。" },
    { name: "zh-CN-YunyangNeural",         label: "云扬 - 专业男声",   preview: "你好，我是云扬，很高兴认识你。" },
    { name: "zh-CN-YunxiNeural",           label: "云希 - 阳光男声",   preview: "你好，我是云希，很高兴认识你。" },
    { name: "zh-CN-YunjianNeural",         label: "云健 - 激情男声",   preview: "你好，我是云健，很高兴认识你。" },
    { name: "zh-CN-XiaochenNeural",        label: "晓辰 - 知性女声",   preview: "你好，我是晓辰，很高兴认识你。" },
    { name: "zh-CN-XiaohanNeural",         label: "晓涵 - 甜美女声",   preview: "你好，我是晓涵，很高兴认识你。" },
    { name: "zh-CN-XiaomoNeural",          label: "晓墨 - 优雅女声",   preview: "你好，我是晓墨，很高兴认识你。" },
    { name: "zh-CN-XiaoruiNeural",         label: "晓睿 - 睿智女声",   preview: "你好，我是晓睿，很高兴认识你。" },
    { name: "zh-CN-XiaoxuanNeural",        label: "晓萱 - 文艺女声",   preview: "你好，我是晓萱，很高兴认识你。" },
    { name: "zh-CN-liaoning-XiaobeiNeural",label: "晓北 - 东北女声",   preview: "你好，我是晓北，很高兴认识你。" },
    { name: "zh-TW-HsiaoChenNeural",       label: "曉臻 - 台湾女声",   preview: "你好，我是曉臻，很高興認識你。" },
    { name: "zh-TW-YunJheNeural",          label: "雲哲 - 台湾男声",   preview: "你好，我是雲哲，很高興認識你。" },
    { name: "zh-HK-HiuGaaiNeural",         label: "曉佳 - 粤语女声",   preview: "你好，我係曉佳，好高興認識你。" },
  ],
  "🇺🇸 English": [
    { name: "en-US-JennyNeural",   label: "Jenny - Friendly Female", preview: "Hello, I'm Jenny. Nice to meet you." },
    { name: "en-US-GuyNeural",     label: "Guy - Professional Male", preview: "Hello, I'm Guy. Nice to meet you." },
    { name: "en-US-AriaNeural",    label: "Aria - Warm Female",      preview: "Hello, I'm Aria. Nice to meet you." },
    { name: "en-US-DavisNeural",   label: "Davis - Casual Male",     preview: "Hello, I'm Davis. Nice to meet you." },
    { name: "en-GB-SoniaNeural",   label: "Sonia - UK Female",       preview: "Hello, I'm Sonia. Nice to meet you." },
    { name: "en-GB-RyanNeural",    label: "Ryan - UK Male",          preview: "Hello, I'm Ryan. Nice to meet you." },
    { name: "en-AU-NatashaNeural", label: "Natasha - AU Female",     preview: "Hello, I'm Natasha. Nice to meet you." },
  ],
  "🇯🇵 日本語": [
    { name: "ja-JP-NanamiNeural", label: "七海 - 女声",  preview: "こんにちは、七海です。よろしくお願いします。" },
    { name: "ja-JP-KeitaNeural",  label: "圭太 - 男声",  preview: "こんにちは、圭太です。よろしくお願いします。" },
  ],
  "🇰🇷 한국어": [
    { name: "ko-KR-SunHiNeural",  label: "선히 - 여성", preview: "안녕하세요, 선히입니다. 만나서 반갑습니다." },
    { name: "ko-KR-InJoonNeural", label: "인준 - 남성", preview: "안녕하세요, 인준입니다. 만나서 반갑습니다." },
  ],
  "🇫🇷 Français": [
    { name: "fr-FR-DeniseNeural", label: "Denise - Femme", preview: "Bonjour, je suis Denise. Ravie de vous rencontrer." },
    { name: "fr-FR-HenriNeural",  label: "Henri - Homme",  preview: "Bonjour, je suis Henri. Ravi de vous rencontrer." },
  ],
  "🇩🇪 Deutsch": [
    { name: "de-DE-KatjaNeural",   label: "Katja - Weiblich",  preview: "Hallo, ich bin Katja. Schön, Sie kennenzulernen." },
    { name: "de-DE-ConradNeural",  label: "Conrad - Männlich", preview: "Hallo, ich bin Conrad. Schön, Sie kennenzulernen." },
  ],
};

// 音频输出格式映射
const OUTPUT_FORMAT_MAP = {
  mp3: { format: "audio-24khz-48kbitrate-mono-mp3", mime: "audio/mpeg",     ext: "mp3" },
  ogg: { format: "ogg-24khz-16bit-mono-opus",       mime: "audio/ogg",      ext: "ogg" },
  wav: { format: "riff-24khz-16bit-mono-pcm",       mime: "audio/wav",      ext: "wav" },
};
let tokenInfo = { endpoint: null, token: null, expiredAt: null };
const TOKEN_REFRESH_BEFORE_EXPIRY = 5 * 60;

// 基于域名生成唯一的用户ID
function generateUserIdFromDomain(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const domain = url.hostname;
    // 使用简单的哈希算法生成16位十六进制用户ID
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      const char = domain.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    // 转换为16位十六进制字符串，确保为正数
    return (
      Math.abs(hash).toString(16).padStart(8, "0") +
      Math.abs(hash * 31)
        .toString(16)
        .padStart(8, "0")
    );
  } catch (error) {
    // 如果解析失败，使用默认值
    console.warn(
      "Failed to generate userId from domain, using default:",
      error
    );
    return "0f04d16a175c411e";
  }
}

// =================================================================================
// Cloudflare Pages Entry Point
// =================================================================================

export default {
  async fetch(request, env, ctx) {
    if (env.API_KEY) {
      globalThis.API_KEY = env.API_KEY;
    }
    if (env.TTS_HISTORY) {
      globalThis.TTS_HISTORY = env.TTS_HISTORY;
    }
    if (env.ALLOWED_ORIGIN) {
      globalThis.ALLOWED_ORIGIN = env.ALLOWED_ORIGIN;
    }
    return await handleRequest(request);
  },
};

// =================================================================================
// Main Request Handler
// =================================================================================

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(getWebUIHTML(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Handle favicon
  if (url.pathname === "/favicon.ico") {
    return new Response(getFaviconSVG(), {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  if (url.pathname.startsWith("/v1/")) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(
        "Missing or invalid authorization header.",
        401,
        "invalid_api_key"
      );
    }

    const providedKey = authHeader.slice(7);

    // 检查是否为分享UUID
    if (providedKey.startsWith("share_")) {
      const shareUUID = providedKey.replace("share_", "");
      console.log("Share UUID validation for:", shareUUID);

      if (!globalThis.TTS_HISTORY) {
        return errorResponse("KV storage not configured", 500, "storage_error");
      }

      try {
        const shareAuthData = await globalThis.TTS_HISTORY.get(
          `share_auth_${shareUUID}`
        );
        if (!shareAuthData) {
          console.log("Share UUID not found");
          return errorResponse("Invalid share UUID.", 403, "invalid_api_key");
        }

        // 解析请求体以验证内容哈希
        const requestBody = await request.clone().json();
        const shareData = {
          text: requestBody.input,
          voice: requestBody.voice,
          speed: requestBody.speed,
          pitch: requestBody.pitch,
          style: requestBody.style,
          role: requestBody.role,
          styleDegree: requestBody.styleDegree,
          cleaningOptions: requestBody.cleaning_options,
        };

        const contentString = JSON.stringify(shareData);
        const contentHash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(contentString)
        );
        const hashArray = Array.from(new Uint8Array(contentHash));

        const authData = JSON.parse(shareAuthData);
        const storedHash = authData.contentHash;

        // 比较哈希值
        if (JSON.stringify(hashArray) !== JSON.stringify(storedHash)) {
          console.log("Content hash mismatch");
          return errorResponse(
            "Content validation failed.",
            403,
            "invalid_content"
          );
        }

        console.log("Share UUID validation passed");
      } catch (error) {
        console.log("Share UUID validation error:", error);
        return errorResponse(
          "Share validation failed.",
          403,
          "validation_error"
        );
      }
    } else if (globalThis.API_KEY) {
      // 常规API Key验证
      if (providedKey !== globalThis.API_KEY) {
        return errorResponse("Invalid API key.", 403, "invalid_api_key");
      }
    }
  }

  try {
    if (url.pathname === "/v1/audio/speech")
      return await handleSpeechRequest(request);
    if (url.pathname === "/v1/models") return handleModelsRequest();
    if (url.pathname === "/history") return await handleHistoryRequest(request);
    if (/^\/share\/[^/]+\/auth$/.test(url.pathname))
      return await handleShareAuthRequest(request);
    if (url.pathname.startsWith("/share/"))
      return await handleShareRequest(request);
    if (url.pathname === "/play") return await handlePlayPageRequest(request);
    if (url.pathname === "/api/save") return await handleSaveRequest(request);
    if (url.pathname === "/api/save-realtime")
      return await handleSaveRealtimeRequest(request);
    if (url.pathname === "/api/history")
      return await handleHistoryApiRequest(request);
    if (url.pathname === "/api/set-password")
      return await handleSetPasswordRequest(request);
    if (url.pathname === "/api/delete")
      return await handleDeleteRequest(request);
    if (url.pathname === "/api/clear-history")
      return await handleHistoryClearRequest(request);
    if (url.pathname.startsWith("/api/audio/"))
      return await handleAudioRequest(request);
  } catch (err) {
    return errorResponse(err.message, 500, "internal_server_error");
  }

  return errorResponse("Not Found", 404, "not_found");
}

// =================================================================================
// API Route Handlers
// =================================================================================

function validateManagementApiKey(request, message = "API key required") {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(message, 401, "unauthorized");
  }

  if (globalThis.API_KEY) {
    const providedKey = authHeader.slice(7);
    if (providedKey !== globalThis.API_KEY) {
      return errorResponse("Invalid API key", 403, "invalid_api_key");
    }
  }

  return null;
}

// Handle save realtime play to history
async function handleSaveRealtimeRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");
  }

  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(request);
  if (authError) {
    return authError;
  }

  try {
    const realtimeData = await request.json();

    if (!realtimeData.text) {
      return errorResponse("Missing required fields", 400, "invalid_request");
    }

    // Generate unique ID
    const id = crypto.randomUUID();
    const shareUUID = crypto.randomUUID();
    const timestamp = Date.now();

    // 创建用于哈希的内容数据
    const shareData = {
      text: realtimeData.text,
      voice: realtimeData.voice,
      speed: realtimeData.speed,
      pitch: realtimeData.pitch,
      style: realtimeData.style,
      role: realtimeData.role,
      styleDegree: realtimeData.styleDegree,
      cleaningOptions: realtimeData.cleaningOptions,
    };

    // 生成内容哈希
    const contentString = JSON.stringify(shareData);
    const contentHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(contentString)
    );
    const hashArray = Array.from(new Uint8Array(contentHash));

    // Create metadata for realtime play
    const metadata = {
      id,
      shareUUID, // 添加分享UUID
      text: realtimeData.text,
      voice: realtimeData.voice,
      speed: realtimeData.speed,
      pitch: realtimeData.pitch,
      style: realtimeData.style,
      role: realtimeData.role,
      styleDegree: realtimeData.styleDegree,
      cleaningOptions: realtimeData.cleaningOptions,
      timestamp,
      summary:
        realtimeData.text.substring(0, 100) +
        (realtimeData.text.length > 100 ? "..." : ""),
      type: "realtime", // 标记为实时播放类型
      size: 0, // 实时播放不存储音频文件
    };

    // Save metadata only (no audio file)
    await globalThis.TTS_HISTORY.put(`meta_${id}`, JSON.stringify(metadata), {
      metadata: { type: "realtime", timestamp },
    });

    // 保存分享授权数据
    await globalThis.TTS_HISTORY.put(
      `share_auth_${shareUUID}`,
      JSON.stringify({
        contentHash: hashArray,
        shareData: shareData,
      }),
      {
        metadata: { type: "share_auth", timestamp },
      }
    );

    // Update history index
    await updateHistoryIndex(id, metadata);

    return new Response(
      JSON.stringify({ success: true, id, shareUrl: `/share/${id}` }),
      {
        headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
      }
    );
  } catch (error) {
    return errorResponse(
      `Save realtime failed: ${error.message}`,
      500,
      "save_error"
    );
  }
}

// Handle save TTS to history
async function handleSaveRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");
  }

  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(request);
  if (authError) {
    return authError;
  }

  try {
    // Parse FormData
    const formData = await request.formData();
    const text = formData.get("text");
    const voice = formData.get("voice");
    const audioFormat = formData.get("audioFormat") || "mp3";
    const speed = parseFloat(formData.get("speed"));
    const pitch = parseFloat(formData.get("pitch"));
    const cleaningOptions = JSON.parse(formData.get("cleaningOptions") || "{}");
    const audioFile = formData.get("audioFile");
    const formatInfo = OUTPUT_FORMAT_MAP[audioFormat] || OUTPUT_FORMAT_MAP.mp3;

    if (!text || !audioFile) {
      return errorResponse("Missing required fields", 400, "invalid_request");
    }

    // Generate unique ID
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    // Get audio data as ArrayBuffer
    const audioArrayBuffer = await audioFile.arrayBuffer();
    const audioData = new Uint8Array(audioArrayBuffer);

    // Create metadata
    const metadata = {
      id,
      text,
      voice,
      speed,
      pitch,
      audioFormat: formatInfo.ext,
      audioMime: formatInfo.mime,
      cleaningOptions,
      timestamp,
      summary: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      size: audioData.length,
    };

    // Check storage limit and clean if necessary
    await cleanupStorageIfNeeded(audioData.length);

    // Save audio data directly (no encoding needed)
    await globalThis.TTS_HISTORY.put(`audio_${id}`, audioData, {
      metadata: { type: "audio", timestamp },
    });

    // Save metadata
    await globalThis.TTS_HISTORY.put(`meta_${id}`, JSON.stringify(metadata), {
      metadata: { type: "metadata", timestamp },
    });

    // Update history index
    await updateHistoryIndex(id, metadata);

    return new Response(
      JSON.stringify({ success: true, id, shareUrl: `/share/${id}` }),
      {
        headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
      }
    );
  } catch (error) {
    return errorResponse(`Save failed: ${error.message}`, 500, "save_error");
  }
}

// Handle history page
async function handleHistoryRequest(request) {
  return new Response(getHistoryPageHTML(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Handle history API
async function handleHistoryApiRequest(request) {
  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(
    request,
    "API key required to access history"
  );
  if (authError) {
    return authError;
  }

  try {
    const historyData = await globalThis.TTS_HISTORY.get("history_index");
    const history = historyData ? JSON.parse(historyData) : [];

    // Sort by timestamp (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);

    return new Response(JSON.stringify({ history }), {
      headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
    });
  } catch (error) {
    return errorResponse(
      `Failed to load history: ${error.message}`,
      500,
      "history_error"
    );
  }
}

// Handle set password for share
async function handleSetPasswordRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");
  }

  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(request);
  if (authError) {
    return authError;
  }

  try {
    const { id, password } = await request.json();

    if (!id) {
      return errorResponse("Missing item ID", 400, "invalid_request");
    }

    // Get existing metadata
    const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${id}`);
    if (!metadataStr) {
      return errorResponse("Item not found", 404, "not_found");
    }

    const metadata = JSON.parse(metadataStr);

    // Update password (empty string removes password)
    metadata.password = password || null;

    // Save updated metadata
    await globalThis.TTS_HISTORY.put(`meta_${id}`, JSON.stringify(metadata), {
      metadata: { type: "metadata", timestamp: metadata.timestamp },
    });

    return new Response(
      JSON.stringify({ success: true, hasPassword: !!password }),
      {
        headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
      }
    );
  } catch (error) {
    return errorResponse(
      `Failed to set password: ${error.message}`,
      500,
      "password_error"
    );
  }
}

// Handle delete item
async function handleDeleteRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");
  }

  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(request);
  if (authError) {
    return authError;
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return errorResponse("Missing item ID", 400, "invalid_request");
    }

    const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${id}`);
    const metadata = metadataStr ? JSON.parse(metadataStr) : null;

    // Delete audio and metadata
    await globalThis.TTS_HISTORY.delete(`audio_${id}`);
    await globalThis.TTS_HISTORY.delete(`meta_${id}`);
    if (metadata?.shareUUID) {
      await globalThis.TTS_HISTORY.delete(`share_auth_${metadata.shareUUID}`);
    }

    // Update history index
    const historyData = await globalThis.TTS_HISTORY.get("history_index");
    const history = historyData ? JSON.parse(historyData) : [];
    const updatedHistory = history.filter((item) => item.id !== id);
    await globalThis.TTS_HISTORY.put(
      "history_index",
      JSON.stringify(updatedHistory)
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
    });
  } catch (error) {
    return errorResponse(
      `Failed to delete item: ${error.message}`,
      500,
      "delete_error"
    );
  }
}

async function handleHistoryClearRequest(request) {
  if (request.method !== "POST")
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");

  if (!globalThis.TTS_HISTORY) {
    return errorResponse("KV storage not configured", 500, "storage_error");
  }

  const authError = validateManagementApiKey(request);
  if (authError) {
    return authError;
  }

  try {
    const historyData = await globalThis.TTS_HISTORY.get("history_index");
    if (!historyData) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
      });
    }

    const history = JSON.parse(historyData);
    let deletedCount = 0;

    // Delete every stored object so the KV usage actually drops.
    for (const item of history) {
      const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${item.id}`);
      const metadata = metadataStr ? JSON.parse(metadataStr) : null;

      await globalThis.TTS_HISTORY.delete(`meta_${item.id}`);
      if (item.type !== "realtime") {
        await globalThis.TTS_HISTORY.delete(`audio_${item.id}`);
      }
      if (metadata?.shareUUID) {
        await globalThis.TTS_HISTORY.delete(`share_auth_${metadata.shareUUID}`);
      }
      deletedCount++;
    }

    // Clear the index
    await globalThis.TTS_HISTORY.put("history_index", JSON.stringify([]));

    return new Response(JSON.stringify({ success: true, count: deletedCount }), {
      headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
    });
  } catch (error) {
    return errorResponse(
      `Failed to clear history: ${error.message}`,
      500,
      "delete_error"
    );
  }
}

// Handle play page (page sharing)
async function handlePlayPageRequest(request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  // 获取分享参数
  const text = params.get("text");
  const voice = params.get("voice") || "alloy";
  const speed = parseFloat(params.get("speed")) || 1.0;
  const pitch = parseFloat(params.get("pitch")) || 1.0;
  const style = params.get("style") || "general";
  const role = params.get("role") || "";
  const styleDegree = parseFloat(params.get("styleDegree")) || 1.0;

  if (!text) {
    return errorResponse("Missing text parameter", 400, "invalid_request");
  }

  return new Response(
    getPlayPageHTML({
      text: decodeURIComponent(text),
      voice,
      speed,
      pitch,
      style,
      role,
      styleDegree,
    }),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

// Handle share page
async function handleShareRequest(request) {
  const url = new URL(request.url);
  const id = url.pathname.split("/")[2];
  const providedPassword = url.searchParams.get("pwd");
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);

  if (!id || !globalThis.TTS_HISTORY) {
    return errorResponse("Invalid share link", 404, "not_found");
  }

  try {
    const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${id}`);
    if (!metadataStr) {
      return errorResponse("Share link not found", 404, "not_found");
    }

    const metadata = JSON.parse(metadataStr);

    // Check password protection
    if (metadata.password) {
      const cookieName = `share_auth_${id}`;
      const authorized = cookies[cookieName] === "1";
      if (!authorized) {
        // 兼容旧链接：?pwd= 正确则下发 Cookie 并重定向到干净链接
        if (providedPassword && providedPassword === metadata.password) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/share/${id}`,
              "Set-Cookie": `${cookieName}=1; Max-Age=604800; Path=/share/${id}; HttpOnly; SameSite=Lax; Secure`,
              ...makeCORSHeaders(),
            },
          });
        }
        return new Response(getPasswordPageHTML(id), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    // 检查是否为实时播放类型
    if (metadata.type === "realtime") {
      // 实时播放类型，返回实时播放页面
      return new Response(getRealtimeSharePageHTML(metadata, id), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } else {
      // 传统类型，需要音频文件
      const audioData = await globalThis.TTS_HISTORY.get(`audio_${id}`);
      if (!audioData) {
        return errorResponse("Audio data not found", 404, "not_found");
      }

      return new Response(getSharePageHTML(metadata, id), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } catch (error) {
    return errorResponse(
      `Failed to load share page: ${error.message}`,
      500,
      "share_error"
    );
  }
}

// Handle share page auth (set cookie)
async function handleShareAuthRequest(request) {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");
  }
  const url = new URL(request.url);
  const id = url.pathname.split("/")[2];
  if (!id || !globalThis.TTS_HISTORY) {
    return errorResponse("Invalid share link", 404, "not_found");
  }
  try {
    const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${id}`);
    if (!metadataStr) {
      return errorResponse("Share link not found", 404, "not_found");
    }
    const metadata = JSON.parse(metadataStr);
    if (!metadata.password) {
      // 无密码直接通过
      return new Response(null, {
        status: 204,
        headers: { ...makeCORSHeaders() },
      });
    }
    const contentType = request.headers.get("Content-Type") || "";
    let password = "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      password = body.password || "";
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      password = form.get("password") || "";
    }
    if (password !== metadata.password) {
      return errorResponse("Invalid password", 401, "unauthorized");
    }
    const cookieName = `share_auth_${id}`;
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": `${cookieName}=1; Max-Age=604800; Path=/share/${id}; HttpOnly; SameSite=Lax; Secure`,
        ...makeCORSHeaders(),
      },
    });
  } catch (error) {
    return errorResponse(`Auth failed: ${error.message}`, 500, "auth_error");
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

// Handle audio file serving
async function handleAudioRequest(request) {
  const url = new URL(request.url);
  const id = url.pathname.split("/")[3];

  if (!id || !globalThis.TTS_HISTORY) {
    return errorResponse("Invalid audio request", 404, "not_found");
  }

  try {
    const metadataStr = await globalThis.TTS_HISTORY.get(`meta_${id}`);
    const metadata = metadataStr ? JSON.parse(metadataStr) : null;
    const audioData = await globalThis.TTS_HISTORY.get(
      `audio_${id}`,
      "arrayBuffer"
    );
    if (!audioData) {
      return errorResponse("Audio not found", 404, "not_found");
    }

    return new Response(audioData, {
      headers: {
        "Content-Type": metadata?.audioMime || "audio/mpeg",
        "Content-Length": audioData.byteLength.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
        ...makeCORSHeaders(),
      },
    });
  } catch (error) {
    return errorResponse(
      `Failed to serve audio: ${error.message}`,
      500,
      "audio_error"
    );
  }
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...makeCORSHeaders(),
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") ||
        "Authorization, Content-Type",
    },
  });
}

async function handleSpeechRequest(request) {
  if (request.method !== "POST")
    return errorResponse("Method Not Allowed", 405, "method_not_allowed");

  const requestBody = await request.json();
  if (!requestBody.input)
    return errorResponse(
      "'input' is a required parameter.",
      400,
      "invalid_request_error"
    );

  const {
    model = "tts-1",
    input,
    voice,
    speed = 1.0,
    pitch = 1.0,
    style = "general",
    role = "",
    styleDegree = 1.0,
    stream = false,
    cleaning_options = {},
    response_format = "mp3",
    ssml = "",
  } = requestBody;

  // OpenAI 兼容性处理
  let finalVoice;
  if (model === "tts-1" || model === "tts-1-hd") {
    finalVoice = OPENAI_VOICE_MAP[voice] || voice || "zh-CN-XiaoxiaoNeural";
  } else if (model.startsWith("tts-1-")) {
    finalVoice =
      OPENAI_VOICE_MAP[model.replace("tts-1-", "")] || "zh-CN-XiaoxiaoNeural";
  } else {
    finalVoice = voice || model || "zh-CN-XiaoxiaoNeural";
  }

  const formatInfo = OUTPUT_FORMAT_MAP[response_format] || OUTPUT_FORMAT_MAP.mp3;
  const outputFormat = formatInfo.format;
  const contentType = formatInfo.mime;

  const rate = ((speed - 1) * 100).toFixed(0);
  const numPitch = ((pitch - 1) * 100).toFixed(0);

  // SSML 直通模式：跳过文本清理和分片，直接将 SSML 发送到 Edge TTS
  if (ssml && ssml.trim().startsWith("<speak")) {
    const response = await fetch(`https://${(await getEndpoint(request)).r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: (await getEndpoint(request)).t,
        "Content-Type": "application/ssml+xml",
        "User-Agent": "okhttp/4.5.0",
        "X-Microsoft-OutputFormat": outputFormat,
      },
      body: ssml,
    });
    if (!response.ok) {
      const errorText = await response.text();
      return errorResponse(`Edge TTS SSML error: ${response.status} ${errorText}`, 502, "tts_error");
    }
    return new Response(response.body, {
      headers: { "Content-Type": contentType, ...makeCORSHeaders() },
    });
  }

  const finalCleaningOptions = {
    remove_code_blocks: true,
    remove_markdown: true,
    remove_emoji: true,
    remove_urls: true,
    remove_line_breaks: false,
    remove_citation_numbers: true,
    custom_keywords: "",
    ...cleaning_options,
  };
  const cleanedInput = cleanText(input, finalCleaningOptions);

  if (stream) {
    return await getVoiceStream(
      cleanedInput,
      finalVoice,
      rate,
      numPitch,
      style,
      role,
      styleDegree,
      outputFormat,
      contentType,
      request
    );
  } else {
    // Try Cloudflare Cache API for non-streaming requests
    const cacheKey = await buildCacheKey(
      request,
      cleanedInput,
      finalVoice,
      rate,
      numPitch,
      style,
      role,
      styleDegree,
      outputFormat
    );
    const cache = caches.default;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const audioResponse = await getVoice(
      cleanedInput,
      finalVoice,
      rate,
      numPitch,
      style,
      role,
      styleDegree,
      outputFormat,
      contentType,
      request
    );

    // Cache the response – clone before consuming the body
    const responseToCache = new Response(audioResponse.clone().body, {
      status: audioResponse.status,
      headers: {
        ...Object.fromEntries(audioResponse.headers),
        "Cache-Control": "public, max-age=86400",
      },
    });
    // Store in cache without awaiting to avoid blocking the response
    cache.put(cacheKey, responseToCache.clone());
    return audioResponse;
  }
}

function handleModelsRequest() {
  const models = [
    { id: "tts-1", object: "model", created: Date.now(), owned_by: "openai" },
    {
      id: "tts-1-hd",
      object: "model",
      created: Date.now(),
      owned_by: "openai",
    },
    ...Object.keys(OPENAI_VOICE_MAP).map((v) => ({
      id: `tts-1-${v}`,
      object: "model",
      created: Date.now(),
      owned_by: "openai",
    })),
  ];
  return new Response(JSON.stringify({ object: "list", data: models }), {
    headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
  });
}

// =================================================================================
// Core TTS Logic (Android App Simulation)
// =================================================================================

async function getVoice(
  text,
  voiceName,
  rate,
  pitch,
  style,
  role,
  styleDegree,
  outputFormat,
  contentType,
  request
) {
  const maxChunkSize = 2000;
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }
  const audioChunks = [];
  for (const chunk of chunks) {
    const audioChunk = await getAudioChunk(
      chunk,
      voiceName,
      rate,
      pitch,
      style,
      role,
      styleDegree,
      outputFormat,
      request
    );
    audioChunks.push(audioChunk);
  }
  const concatenatedAudio = new Blob(audioChunks, { type: contentType });
  return new Response(concatenatedAudio, {
    headers: { "Content-Type": contentType, ...makeCORSHeaders() },
  });
}

async function getVoiceStream(
  text,
  voiceName,
  rate,
  pitch,
  style,
  role,
  styleDegree,
  outputFormat,
  contentType,
  request
) {
  const maxChunkSize = 2000;
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      for (const chunk of chunks) {
        const audioBlob = await getAudioChunk(
          chunk,
          voiceName,
          rate,
          pitch,
          style,
          role,
          styleDegree,
          outputFormat,
          request
        );
        const arrayBuffer = await audioBlob.arrayBuffer();
        await writer.write(new Uint8Array(arrayBuffer));
      }
    } catch (error) {
      await writer.abort(error);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { "Content-Type": contentType, ...makeCORSHeaders() },
  });
}

async function getAudioChunk(
  text,
  voiceName,
  rate,
  pitch,
  style,
  role,
  styleDegree,
  outputFormat,
  request
) {
  const endpoint = await getEndpoint(request);
  const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;

  // 构建高级SSML
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let ssmlContent = `<prosody rate="${rate}%" pitch="${pitch}%">${escapedText}</prosody>`;

  // 添加语音风格和强度
  if (style && style !== "general") {
    const styleAttributes =
      styleDegree !== 1.0 ? ` styledegree="${styleDegree}"` : "";
    ssmlContent = `<mstts:express-as style="${style}"${styleAttributes}>${ssmlContent}</mstts:express-as>`;
  }

  // 添加角色扮演
  if (role) {
    ssmlContent = `<mstts:express-as role="${role}">${ssmlContent}</mstts:express-as>`;
  }

  const ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN"><voice name="${voiceName}">${ssmlContent}</voice></speak>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: endpoint.t,
      "Content-Type": "application/ssml+xml",
      "User-Agent": "okhttp/4.5.0",
      "X-Microsoft-OutputFormat": outputFormat,
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge TTS API error: ${response.status} ${errorText}`);
  }
  return response.blob();
}

async function getEndpoint(request) {
  const now = Date.now() / 1000;
  if (
    tokenInfo.token &&
    now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY
  ) {
    return tokenInfo.endpoint;
  }

  // Check KV cache if available
  if (globalThis.TTS_HISTORY) {
    try {
      const kvToken = await globalThis.TTS_HISTORY.get("MS_TTS_TOKEN", "json");
      if (kvToken && now < kvToken.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
        tokenInfo = kvToken;
        return kvToken.endpoint;
      }
    } catch (kvError) {
      console.warn("KV token read failed, falling back to remote fetch:", kvError.message);
    }
  }

  const endpointUrl =
    "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  const clientId = crypto.randomUUID().replace(/-/g, "");
  const userId = generateUserIdFromDomain(request.url);

  // 重试机制
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Accept-Language": "zh-Hans",
          "X-ClientVersion": "4.0.530a 5fe1dc6c",
          "X-UserId": userId,
          "X-HomeGeographicRegion": "zh-Hans-CN",
          "X-ClientTraceId": clientId,
          "X-MT-Signature": await sign(endpointUrl),
          "User-Agent": "okhttp/4.5.0",
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": "0",
          "Accept-Encoding": "gzip",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const jwt = data.t.split(".")[1];
      const decodedJwt = JSON.parse(atob(jwt));
      tokenInfo = { endpoint: data, token: data.t, expiredAt: decodedJwt.exp };
      // Persist token to KV for cross-instance sharing
      if (globalThis.TTS_HISTORY) {
        try {
          await globalThis.TTS_HISTORY.put("MS_TTS_TOKEN", JSON.stringify(tokenInfo), {
            expiration: decodedJwt.exp - TOKEN_REFRESH_BEFORE_EXPIRY,
          });
        } catch (kvError) {
          console.warn("KV token write failed:", kvError.message);
        }
      }
      return data;
    } catch (error) {
      lastError = error;
      console.error(`Endpoint attempt ${attempt} failed:`, error.message);

      // 如果不是最后一次尝试，等待一下再重试
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // 如果所有重试都失败，尝试使用缓存的 token
  if (tokenInfo.token) {
    console.warn("Using cached token due to endpoint failures");
    return tokenInfo.endpoint;
  }

  throw new Error(
    `Failed to get endpoint after 3 attempts: ${lastError.message}`
  );
}

async function sign(urlStr) {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);
  const uuidStr = crypto.randomUUID().replace(/-/g, "");
  const formattedDate =
    new Date().toUTCString().replace(/GMT/, "").trim() + " GMT";
  const bytesToSign =
    `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
  const keyBytes = await base64ToBytes(
    "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=="
  );
  const signatureBytes = await hmacSha256(keyBytes, bytesToSign);
  const signatureBase64 = await bytesToBase64(signatureBytes);
  return `MSTranslatorAndroidApp::${signatureBase64}::${formattedDate}::${uuidStr}`;
}

// =================================================================================
// Storage Management Functions
// =================================================================================

async function cleanupStorageIfNeeded(newItemSize) {
  if (!globalThis.TTS_HISTORY) return;

  try {
    // Get current storage usage
    const historyData = await globalThis.TTS_HISTORY.get("history_index");
    const history = historyData ? JSON.parse(historyData) : [];

    let totalSize = history.reduce((sum, item) => sum + (item.size || 0), 0);

    // If adding new item would exceed limit, remove oldest items
    while (totalSize + newItemSize > MAX_STORAGE_SIZE && history.length > 0) {
      const oldestItem = history.shift(); // Remove oldest
      totalSize -= oldestItem.size || 0;

      // Delete from KV
      await globalThis.TTS_HISTORY.delete(`audio_${oldestItem.id}`);
      await globalThis.TTS_HISTORY.delete(`meta_${oldestItem.id}`);
    }

    // Update history index
    await globalThis.TTS_HISTORY.put("history_index", JSON.stringify(history));
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

async function updateHistoryIndex(id, metadata) {
  if (!globalThis.TTS_HISTORY) return;

  try {
    const historyData = await globalThis.TTS_HISTORY.get("history_index");
    const history = historyData ? JSON.parse(historyData) : [];

    // Add new item to beginning
    history.unshift({
      id: metadata.id,
      summary: metadata.summary,
      timestamp: metadata.timestamp,
      voice: metadata.voice,
      size: metadata.size,
      hasPassword: !!metadata.password,
      type: metadata.type || "stored", // 添加类型信息
    });

    // Keep only last 1000 items for performance
    if (history.length > 1000) {
      history.splice(1000);
    }

    await globalThis.TTS_HISTORY.put("history_index", JSON.stringify(history));
  } catch (error) {
    console.error("Failed to update history index:", error);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMarkdown(text) {
  if (!text) return "";

  // 简单的Markdown渲染
  let html = text
    // 转义HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

    // 标题
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")

    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")

    // 代码
    .replace(/`([^`]+)`/g, "<code>$1</code>")

    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

    // 换行处理
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // 包装在段落中
  if (html && !html.startsWith("<h") && !html.startsWith("<p>")) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

// =================================================================================
// Utility Functions
// =================================================================================

async function buildCacheKey(request, text, voice, rate, pitch, style, role, styleDegree, outputFormat) {
  const cachePayload = `${text}|${voice}|${rate}|${pitch}|${style}|${role}|${styleDegree}|${outputFormat}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cachePayload));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const url = new URL(request.url);
  return new Request(`${url.origin}/v1/audio/speech/cache/${hashHex}`);
}

function cleanText(text, options) {
  let cleanedText = text;
  if (options.remove_code_blocks)
    cleanedText = cleanedText.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  if (options.remove_urls)
    cleanedText = cleanedText.replace(/(https?:\/\/[^\s]+)/g, "");
  if (options.remove_markdown)
    cleanedText = cleanedText
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
      .replace(/#{1,6}\s/g, "");
  if (options.custom_keywords) {
    const keywords = options.custom_keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k);
    if (keywords.length > 0) {
      const regex = new RegExp(
        keywords
          .map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"))
          .join("|"),
        "g"
      );
      cleanedText = cleanedText.replace(regex, "");
    }
  }
  if (options.remove_emoji)
    cleanedText = cleanedText.replace(/\p{Emoji_Presentation}/gu, "");
  if (options.remove_citation_numbers)
    cleanedText = cleanedText.replace(/\[\d+\]/g, "").replace(/【\d+】/g, "");
  if (options.remove_line_breaks) {
    // 移除换行符，不添加空格，直接连接文本
    cleanedText = cleanedText.replace(/(\r\n|\n|\r)/gm, "");
    // 合并多个连续空格为单个空格
    return cleanedText.trim().replace(/\s+/g, " ");
  } else {
    // 保留换行符，只合并非换行的连续空格
    return cleanedText.trim().replace(/[ \t]+/g, " ");
  }
}

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data)
  );
  return new Uint8Array(signature);
}

async function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function bytesToBase64(bytes) {
  return btoa(String.fromCharCode.apply(null, bytes));
}

function errorResponse(message, status, code) {
  return new Response(
    JSON.stringify({ error: { message, type: "api_error", code } }),
    {
      status,
      headers: { "Content-Type": "application/json", ...makeCORSHeaders() },
    }
  );
}

function makeCORSHeaders(extraHeaders = "Content-Type, Authorization") {
  return {
    "Access-Control-Allow-Origin": globalThis.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": extraHeaders,
    "Access-Control-Max-Age": "86400",
  };
}

// =================================================================================
// Favicon and Assets
// =================================================================================

function getFaviconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="#007bff"/>
    <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" fill="white" text-anchor="middle">🎵</text>
  </svg>`;
}

// =================================================================================
// Embedded WebUI (v7.0 - UI & Auth Fix)
// =================================================================================

function getPasswordPageHTML(id) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} - 访问受限</title>
  <style>
    :root { --primary-color: #007bff; --light-gray: #f8f9fa; --gray: #6c757d; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.8; margin: 0; padding: 1rem; }
    .container { max-width: 520px; margin: 8vh auto 0; background-color: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); text-align: center; }
    .lock-icon { font-size: 3rem; margin-bottom: 1rem; }
    .form-group { margin: 1rem 0; text-align: left; }
    label { display: block; margin-bottom: 0.5rem; color: #333; }
    input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #dee2e6; border-radius: 6px; font-size: 1rem; }
    .btn { width: 100%; margin-top: 0.8rem; background-color: var(--primary-color); color: white; border: none; padding: 0.7rem; border-radius: 6px; cursor: pointer; }
    .error { display: none; color: #dc3545; margin-top: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="lock-icon">🔒</div>
    <h1>内容受保护</h1>
    <p>此分享内容需要密码才能访问</p>
    
    <form id="password-form">
      <div class="form-group">
        <label for="password">请输入访问密码</label>
        <input type="password" id="password" placeholder="输入密码" required>
      </div>
      <button type="submit" class="btn">访问内容</button>
    </form>
    
    <div id="error" class="error">密码错误，请重试</div>
  </div>
 
  <script>
    document.getElementById('password-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      if (!password) return;
      try {
        const res = await fetch('/share/${id}/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res.ok) {
          window.location.href = '/share/${id}';
        } else {
          document.getElementById('error').style.display = 'block';
        }
      } catch (err) {
        document.getElementById('error').style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

function getPlayPageHTML(config) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} 实时播放 - ${config.text.substring(0, 50)}${
    config.text.length > 50 ? "..." : ""
  }</title>
  <meta name="description" content="${config.text.substring(0, 100)}">
  <style>
    :root { --primary-color: #007bff; --success-color: #28a745; --light-gray: #f8f9fa; --gray: #6c757d; --border-color: #dee2e6; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.8; margin: 0; padding: 1rem; }
    .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
    .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
    .title { font-size: 1.5rem; font-weight: 700; color: #333; margin-bottom: 0.5rem; }
    .voice-info { font-size: 0.9rem; color: var(--gray); }
    .content { margin: 2rem 0; }
    .content h1, .content h2, .content h3 { color: #333; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .content h1 { font-size: 1.8rem; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; }
    .content p { margin-bottom: 1rem; }
    .content strong { font-weight: 600; }
    .play-section { background-color: var(--light-gray); padding: 1rem; border-radius: 8px; margin: 1.5rem 0; text-align: center; }
    .play-button { background-color: var(--success-color); color: white; border: none; padding: 0.8rem 2rem; border-radius: 25px; font-size: 1rem; cursor: pointer; margin-bottom: 0.8rem; }
    .play-button:hover { background-color: #218838; }
    .play-button:disabled { background-color: var(--gray); cursor: not-allowed; }
    .audio-player { width: 100%; margin-top: 0.8rem; display: none; }
    .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
    @media (max-width: 768px) {
      body { padding: 0; }
      .container { padding: 1rem; margin: 0; border-radius: 0; box-shadow: none; }
      .title { font-size: 1.3rem; }
      .play-section { padding: 0.8rem; margin: 1rem 0; }
      .play-button { padding: 0.6rem 1.5rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🎵 ${SITE_NAME} 实时播放</div>
      <div class="voice-info">
        音色：${config.voice} | 语速：${config.speed}x | 音调：${config.pitch}
      </div>
    </div>
    
    <div class="play-section">
      <button class="play-button" onclick="playAudio()">
        🎵 点击播放语音
      </button>
      <div id="device-info" style="font-size: 0.85rem; color: var(--gray); margin-top: 0.5rem;"></div>
      <audio id="audioPlayer" class="audio-player" controls></audio>
    </div>
    
    <div class="content">
      ${renderMarkdown(config.text)}
    </div>
    
    <div class="footer">
      <a href="/" style="color: var(--gray); text-decoration: none;">← 返回 ${SITE_NAME}</a>
    </div>
  </div>

  <script>
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let audioLoaded = false;
    
    // 显示设备信息
    document.addEventListener('DOMContentLoaded', () => {
      const deviceInfo = document.getElementById('device-info');
      if (isMobile) {
        deviceInfo.textContent = '📱 移动端检测：将使用标准播放模式，请耐心等待语音生成';
      } else {
        deviceInfo.textContent = '🖥️ PC端检测：将使用流式播放模式，可快速开始播放';
      }
    });
    
    async function playAudio() {
      const audio = document.getElementById('audioPlayer');
      const button = document.querySelector('.play-button');
      
      if (audioLoaded) {
        try {
          audio.style.display = 'block';
          await audio.play();
        } catch (error) {
          alert('播放失败: ' + error.message);
        }
        return;
      }
      
      button.textContent = '⏳ 正在生成语音...';
      button.disabled = true;
      
      try {
        const requestBody = {
          model: "tts-1",
          voice: "${config.voice}",
          input: ${JSON.stringify(config.text)},
          speed: ${config.speed},
          pitch: ${config.pitch},
          style: "${config.style}",
          role: "${config.role}",
          styleDegree: ${config.styleDegree},
          stream: !isMobile,
          cleaning_options: {
            remove_markdown: true,
            remove_emoji: true,
            remove_urls: true,
            remove_line_breaks: true,
            remove_citation_numbers: true
          }
        };
        
        const response = await fetch('/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: \`服务器错误: \${response.statusText}\` } }));
          throw new Error(errorData.error.message);
        }
        
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('音频文件为空');
        
        audio.src = URL.createObjectURL(blob);
        audioLoaded = true;
        button.textContent = '🎵 点击播放语音';
        button.disabled = false;
        
        audio.style.display = 'block';
        await audio.play();
        
      } catch (error) {
        button.textContent = '❌ 生成失败';
        button.disabled = false;
        alert('语音生成失败: ' + error.message);
      }
    }
  </script>
</body>
</html>`;
}

function getRealtimeSharePageHTML(metadata, id) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} 实时播放 - ${metadata.summary}</title>
  <meta name="description" content="${metadata.summary}">
  <style>
    :root { --primary-color: #007bff; --success-color: #28a745; --light-gray: #f8f9fa; --gray: #6c757d; --border-color: #dee2e6; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.8; margin: 0; padding: 1rem; }
    .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
    .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
    .title { font-size: 1.5rem; font-weight: 700; color: #333; margin-bottom: 0.5rem; }
    .meta { font-size: 0.9rem; color: var(--gray); }
    .content { margin: 2rem 0; }
    .content h1, .content h2, .content h3 { color: #333; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .content h1 { font-size: 1.8rem; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; }
    .content p { margin-bottom: 1rem; }
    .content strong { font-weight: 600; }
    .play-section { background-color: var(--light-gray); padding: 1rem; border-radius: 8px; margin: 1.5rem 0; text-align: center; }
    .play-button { background-color: var(--success-color); color: white; border: none; padding: 0.8rem 2rem; border-radius: 25px; font-size: 1rem; cursor: pointer; margin-bottom: 0.8rem; }
    .play-button:hover { background-color: #218838; }
    .play-button:disabled { background-color: var(--gray); cursor: not-allowed; }
    .device-info { font-size: 0.85rem; color: var(--gray); margin-top: 0.5rem; }
    .audio-player { width: 100%; margin-top: 0.8rem; display: none; }
    .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
    @media (max-width: 768px) {
      body { padding: 0; }
      .container { padding: 1rem; margin: 0; border-radius: 0; box-shadow: none; }
      .title { font-size: 1.3rem; }
      .play-section { padding: 0.8rem; margin: 1rem 0; }
      .play-button { padding: 0.6rem 1.5rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🎵 ${SITE_NAME} 实时播放分享</div>
      <div class="meta">
        ${formatDate(metadata.timestamp)} • ${metadata.voice} • 实时生成
      </div>
    </div>
    
    <div class="play-section">
      <button class="play-button" onclick="playAudio()">
        🎵 点击播放语音
      </button>
      <div class="device-info" id="device-info"></div>
      <audio id="audioPlayer" class="audio-player" controls></audio>
    </div>
    
    <div class="content">
      ${renderMarkdown(metadata.text)}
    </div>
    
    <div class="footer">
      <div class="share-buttons" style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
        <button class="share-btn share-copy" onclick="copyLink()" style="padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; background-color: var(--primary-color); color: white;">📋 复制链接</button>
      </div>
      <div style="margin-bottom: 1rem;">
        <a href="/" style="color: var(--gray); text-decoration: none;">← 返回 ${SITE_NAME}</a>
      </div>
      <div style="padding-top: 1rem; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: var(--gray);">
        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray); text-decoration: none;">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub 项目
          </a>
          <span>|</span>
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="color: var(--gray); text-decoration: none;">⭐ Star</a>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.8rem;">
          Powered by Edge TTS & Cloudflare Pages
        </div>
      </div>
    </div>
  </div>

  <script>
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let audioLoaded = false;
    
    // 显示设备信息
    document.addEventListener('DOMContentLoaded', () => {
      const deviceInfo = document.getElementById('device-info');
      if (isMobile) {
        deviceInfo.textContent = '📱 移动端检测：将使用标准播放模式，请耐心等待语音生成';
      } else {
        deviceInfo.textContent = '🖥️ PC端检测：将使用流式播放模式，可快速开始播放';
      }
    });
    
    async function playAudio() {
      const audio = document.getElementById('audioPlayer');
      const button = document.querySelector('.play-button');
      
      if (audioLoaded) {
        try {
          audio.style.display = 'block';
          await audio.play();
        } catch (error) {
          alert('播放失败: ' + error.message);
        }
        return;
      }
      
      const isStreaming = !isMobile;
      button.textContent = isStreaming ? '⏳ 正在启动流式播放...' : '⏳ 正在生成语音...';
      button.disabled = true;
      
      try {
        const requestBody = {
          model: "tts-1",
          voice: "${metadata.voice}",
          input: ${JSON.stringify(metadata.text)},
          speed: ${metadata.speed},
          pitch: ${metadata.pitch},
          style: "${metadata.style || "general"}",
          role: "${metadata.role || ""}",
          styleDegree: ${metadata.styleDegree || 1.0},
          stream: isStreaming,
          cleaning_options: ${JSON.stringify(metadata.cleaningOptions || {})}
        };
        
        console.log('Device detection:', { isMobile, isStreaming });
        console.log('Request body:', requestBody);
        
        const startTime = Date.now();
        
        const response = await fetch('/v1/audio/speech', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer share_${metadata.shareUUID}'
          },
          body: JSON.stringify(requestBody)
        });
        
        const responseTime = Date.now() - startTime;
        console.log(\`Response received in \${responseTime}ms, streaming: \${isStreaming}\`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: \`服务器错误: \${response.statusText}\` } }));
          throw new Error(errorData.error.message);
        }
        
        if (isStreaming) {
          // 使用 MediaSource 进行真正的流式播放
          button.textContent = '⏳ 正在处理流式数据...';
          const mediaSource = new MediaSource();
          audio.src = URL.createObjectURL(mediaSource);
          audio.style.display = 'block';
          audio.play().catch(() => {});

          mediaSource.addEventListener('sourceopen', () => {
            const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
            const reader = response.body.getReader();
            const pump = () => {
              reader.read().then(({ done, value }) => {
                if (done) {
                  if (!sourceBuffer.updating) mediaSource.endOfStream();
                  audioLoaded = true;
                  button.textContent = '🎵 点击播放语音';
                  button.disabled = false;
                  return;
                }
                const append = () => sourceBuffer.appendBuffer(value);
                if (sourceBuffer.updating) {
                  sourceBuffer.addEventListener('updateend', append, { once: true });
                } else {
                  append();
                }
              }).catch(err => {
                console.error('Stream error:', err);
                try { mediaSource.endOfStream('network'); } catch (_) {}
                button.textContent = '❌ 生成失败';
                button.disabled = false;
              });
            };
            sourceBuffer.addEventListener('error', (e) => console.error('SourceBuffer error:', e));
            mediaSource.addEventListener('error', (e) => console.error('MediaSource error:', e));
            sourceBuffer.addEventListener('updateend', pump);
            pump();
          }, { once: true });
        } else {
          const blob = await response.blob();
          if (blob.size === 0) throw new Error('音频文件为空');

          const totalTime = Date.now() - startTime;
          console.log(\`Audio ready in \${totalTime}ms, size: \${blob.size} bytes\`);

          audio.src = URL.createObjectURL(blob);
          audioLoaded = true;
          button.textContent = '🎵 点击播放语音';
          button.disabled = false;

          audio.style.display = 'block';
          await audio.play();

          console.log(\`Total time from click to play: \${Date.now() - startTime}ms\`);
        }
        
      } catch (error) {
        button.textContent = '❌ 生成失败';
        button.disabled = false;
        alert('语音生成失败: ' + error.message);
      }
    }
    
    function copyLink() {
      // 移除URL中的密码参数，确保分享链接不包含密码
      const url = new URL(window.location.href);
      url.searchParams.delete('pwd'); // 移除密码参数
      const cleanUrl = url.toString();
      
      navigator.clipboard.writeText(cleanUrl).then(() => {
        const btn = document.querySelector('.share-copy');
        const originalText = btn.textContent;
        btn.textContent = '✅ 已复制';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }).catch(() => {
        prompt('复制链接:', cleanUrl);
      });
    }
  </script>
</body>
</html>`;
}

function getSharePageHTML(metadata, id) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} 分享 - ${metadata.summary}</title>
  <meta name="description" content="${metadata.summary}">
  <style>
    :root { --primary-color: #007bff; --success-color: #28a745; --light-gray: #f8f9fa; --gray: #6c757d; --border-color: #dee2e6; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.8; margin: 0; padding: 1rem; }
    .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
    .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
    .title { font-size: 1.5rem; font-weight: 700; color: #333; margin-bottom: 0.5rem; }
    .meta { font-size: 0.9rem; color: var(--gray); }
    .content { margin: 2rem 0; }
    .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 { color: #333; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .content h1 { font-size: 1.8rem; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; }
    .content h2 { font-size: 1.5rem; }
    .content h3 { font-size: 1.3rem; }
    .content p { margin-bottom: 1rem; }
    .content blockquote { border-left: 4px solid var(--primary-color); padding-left: 1rem; margin: 1rem 0; font-style: italic; color: var(--gray); }
    .content code { background-color: #f1f3f4; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: 'Courier New', monospace; }
    .content pre { background-color: #f8f9fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .content ul, .content ol { margin-bottom: 1rem; padding-left: 2rem; }
    .content li { margin-bottom: 0.3rem; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
    .audio-section { background-color: var(--light-gray); padding: 1rem; border-radius: 8px; margin: 1.5rem 0; text-align: center; }
    .play-button { background-color: var(--success-color); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 25px; font-size: 0.9rem; cursor: pointer; margin-bottom: 0.8rem; display: inline-flex; align-items: center; gap: 0.4rem; }
    .play-button:hover { background-color: #218838; }
    .audio-player { width: 100%; margin-top: 0.8rem; display: none; }
    .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
    .share-buttons { display: flex; justify-content: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
    .share-btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9rem; }
    .share-copy { background-color: var(--primary-color); color: white; }
    .back-link { color: var(--gray); text-decoration: none; font-size: 0.9rem; }
    @media (max-width: 768px) {
      body { padding: 0; }
      .container { padding: 1rem; margin: 0; border-radius: 0; box-shadow: none; }
      .title { font-size: 1.3rem; }
      .content h1 { font-size: 1.5rem; }
      .audio-section { padding: 0.8rem; margin: 1rem 0; }
      .play-button { padding: 0.5rem 1rem; font-size: 0.85rem; }
      .share-buttons { flex-direction: column; align-items: center; }
      .header { margin-bottom: 1.5rem; padding-bottom: 0.8rem; }
      .footer { margin-top: 1.5rem; padding-top: 0.8rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🎵 TTS 语音分享</div>
      <div class="meta">
        ${formatDate(metadata.timestamp)} • ${
    metadata.voice
  } • ${formatFileSize(metadata.size)}
      </div>
    </div>
    
    <div class="audio-section">
      <button class="play-button" onclick="playAudio()">
        ▶️ 播放语音
      </button>
      <audio id="audioPlayer" class="audio-player" controls>
        您的浏览器不支持音频播放。
      </audio>
    </div>
    
    <div class="content" id="content">
      ${renderMarkdown(metadata.text)}
    </div>
    
    <div class="footer">
      <div class="share-buttons">
        <button class="share-btn share-copy" onclick="copyLink()">📋 复制链接</button>
      </div>
      <div style="margin-top: 1rem;">
        <a href="/" class="back-link">← 返回 ${SITE_NAME}</a>
      </div>
      <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center; font-size: 0.85rem; color: var(--gray);">
        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray); text-decoration: none;">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub 项目
          </a>
          <span>|</span>
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="color: var(--gray); text-decoration: none;">⭐ Star</a>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.8rem;">
          Powered by Edge TTS & Cloudflare Pages
        </div>
      </div>
    </div>
  </div>

  <script>
    let audioLoaded = false;
    
    async function playAudio() {
      const audio = document.getElementById('audioPlayer');
      const button = document.querySelector('.play-button');
      
      if (!audioLoaded) {
        button.textContent = '⏳ 加载中...';
        button.disabled = true;
        
        try {
          const response = await fetch('/api/audio/${id}');
          if (response.ok) {
            const blob = await response.blob();
            
            // 验证 blob 是否有效
            if (blob.size === 0) {
              throw new Error('音频文件为空');
            }
            
            audio.src = URL.createObjectURL(blob);
            audioLoaded = true;
            button.textContent = '▶️ 播放语音';
            button.disabled = false;
            
            // 添加音频加载完成事件
            audio.addEventListener('canplaythrough', () => {
              console.log('Audio loaded successfully');
            }, { once: true });
            
            audio.addEventListener('error', (e) => {
              console.error('Audio error:', e);
              button.textContent = '❌ 播放失败';
              alert('音频播放失败，请重试');
            });
            
          } else {
            const errorText = await response.text();
            throw new Error(\`HTTP \${response.status}: \${errorText}\`);
          }
        } catch (error) {
          console.error('Audio loading error:', error);
          button.textContent = '❌ 加载失败';
          button.disabled = false;
          alert('音频加载失败: ' + error.message);
          return;
        }
      }
      
      try {
        audio.style.display = 'block';
        await audio.play();
      } catch (playError) {
        console.error('Audio play error:', playError);
        alert('播放失败: ' + playError.message);
      }
    }
    
    function copyLink() {
      // 移除URL中的密码参数，确保分享链接不包含密码
      const url = new URL(window.location.href);
      url.searchParams.delete('pwd'); // 移除密码参数
      const cleanUrl = url.toString();
      
      navigator.clipboard.writeText(cleanUrl).then(() => {
        const btn = document.querySelector('.share-copy');
        const originalText = btn.textContent;
        btn.textContent = '✅ 已复制';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }).catch(() => {
        prompt('复制链接:', cleanUrl);
      });
    }
  </script>
</body>
</html>`;
}

function getHistoryPageHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} 历史记录</title>
  <style>
    :root { --primary-color: #007bff; --success-color: #28a745; --error-color: #dc3545; --light-gray: #f8f9fa; --gray: #6c757d; --border-color: #dee2e6; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.6; margin: 0; padding: 2rem; }
    .container { max-width: 1000px; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
    h1 { text-align: center; color: #333; margin-bottom: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .back-btn { background-color: var(--gray); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; text-decoration: none; }
    .history-item { border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; background-color: #fff; }
    .item-header { display: flex; justify-content: between; align-items: flex-start; margin-bottom: 1rem; }
    .item-summary { flex-grow: 1; font-weight: 600; color: #333; margin-bottom: 0.5rem; }
    .item-meta { font-size: 0.85rem; color: var(--gray); }
    .item-actions { display: flex; gap: 0.5rem; }
    
    /* 历史记录移动端优化 */
    @media (max-width: 768px) {
      .container { padding: 1rem; margin: 0; border-radius: 0; box-shadow: none; }
      body { padding: 0; }
      .history-item { padding: 1rem; margin-bottom: 0.8rem; border-radius: 6px; }
      .item-header { flex-direction: column; align-items: stretch; margin-bottom: 0.8rem; }
      .item-actions { justify-content: space-between; margin-top: 0.8rem; gap: 0.3rem; }
      .btn { padding: 0.6rem 0.4rem; font-size: 0.75rem; flex: 1; }
      .item-summary { margin-bottom: 0.3rem; font-size: 0.95rem; }
      .item-meta { font-size: 0.8rem; }
      h1 { font-size: 1.3rem; margin-bottom: 1rem; }
      .header { margin-bottom: 1rem; }
      .back-btn { padding: 0.5rem 1rem; font-size: 0.85rem; }
    }
    .btn { padding: 0.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin: 0 0.2rem; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .btn-play { background-color: var(--success-color); color: white; }
    .btn-play:hover { background-color: #218838; }
    .btn-share { background-color: var(--primary-color); color: white; }
    .btn-share:hover { background-color: #0056b3; }
    .btn-password { background-color: #ffc107; color: #212529; }
    .btn-password:hover { background-color: #e0a800; }
    .btn-delete { background-color: #dc3545; color: white; }
    .btn-delete:hover { background-color: #c82333; }
    .loading { text-align: center; padding: 2rem; color: var(--gray); }
    .empty { text-align: center; padding: 3rem; color: var(--gray); }
    audio { width: 100%; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 ${SITE_NAME} 历史记录</h1>
      <a href="/" class="back-btn">← 返回主页</a>
    </div>
    
    <div class="filter-bar">
      <div class="tag-filters" id="tag-filters">
        <button class="tag-btn active" data-tag="all">全部</button>
        <button class="tag-btn" data-tag="realtime">🌐 实时</button>
        <button class="tag-btn" data-tag="stored">💾 预存</button>
        <button class="tag-btn" data-tag="password">🔒 加密</button>
      </div>
      <div>
        <button class="btn btn-delete" onclick="clearAllHistory()" style="padding: 0.4rem 0.8rem;">🗑️ 清空所有</button>
      </div>
    </div>
    
    <div id="loading" class="loading">正在加载历史记录...</div>
    <div id="history-list"></div>
  </div>

  <style>
    .filter-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .tag-filters { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag-btn { background: #e9ecef; border: 1px solid #ced4da; padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.8rem; cursor: pointer; color: #495057; transition: all 0.2s; }
    .tag-btn:hover { background: #dde2e6; }
    .tag-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
  </style>

  <script>
    async function loadHistory() {
      try {
        const apiKey = getCookie('apiKey');
        if (!apiKey) {
          document.getElementById('loading').innerHTML = '<div class="empty">请先设置 API Key 才能查看历史记录<br><a href="/">返回主页设置</a></div>';
          return;
        }
        
        const response = await fetch('/api/history', {
          headers: {
            'Authorization': \`Bearer \${apiKey}\`
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(response.status === 401 || response.status === 403 ? 'API Key 错误或验证失败' : \`加载失败: \${response.status}\`);
        }
        
        const data = await response.json();
        
        document.getElementById('loading').style.display = 'none';
        
        // 保存全局数据以便于过滤
        window.allHistoryData = data.history;
        renderHistory(data.history);
      } catch (error) {
        document.getElementById('loading').innerHTML = '<div class="empty">加载失败: ' + error.message + '</div>';
      }
    }
    
    function renderHistory(historyItems) {
      if (!historyItems || historyItems.length === 0) {
        document.getElementById('history-list').innerHTML = '<div class="empty">暂无相关历史记录</div>';
        return;
      }
      
      const historyHtml = historyItems.map(item => \`
        <div class="history-item" data-type="\${item.type || 'stored'}" data-has-password="\${item.hasPassword || false}">
          <div class="item-header">
            <div style="flex-grow: 1;">
              <div class="item-summary">\${item.summary}</div>
              <div class="item-meta">
                \${formatDate(item.timestamp)} • \${item.voice} • \${formatFileSize(item.size)}
                \${item.hasPassword ? ' • 🔒 已设密码' : ''}
                \${item.type === 'realtime' ? ' • 🌐 实时播放' : ' • 💾 预存储'}
              </div>
            </div>
            <div class="item-actions">
              <button class="btn btn-play" onclick="playAudio('\${item.id}', '\${item.type || 'stored'}')" title="播放">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
              <button class="btn btn-share" onclick="shareItem('\${item.id}')" title="分享">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                </svg>
              </button>
              <button class="btn btn-password" onclick="setPassword('\${item.id}')" title="设置密码">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0-1.71,1.39-3.1,3.1-3.1s3.1,1.39,3.1,3.1V8z"/>
                </svg>
              </button>
              <button class="btn btn-delete" onclick="deleteItem('\${item.id}')" title="删除">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          </div>
          <audio id="audio-\${item.id}" controls style="display: none;"></audio>
        </div>
      \`).join('');
      
      document.getElementById('history-list').innerHTML = historyHtml;
    }
    
    // 标签筛选逻辑
    document.getElementById('tag-filters').addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-btn')) {
        document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const filterTag = e.target.dataset.tag;
        const allData = window.allHistoryData || [];
        
        if (filterTag === 'all') {
          renderHistory(allData);
        } else if (filterTag === 'password') {
          renderHistory(allData.filter(item => item.hasPassword));
        } else {
          renderHistory(allData.filter(item => (item.type || 'stored') === filterTag));
        }
      }
    });
    
    function formatDate(timestamp) {
      return new Date(timestamp).toLocaleString('zh-CN');
    }
    
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async function playAudio(id, type = 'stored') {
      const audio = document.getElementById(\`audio-\${id}\`);
      const button = document.querySelector(\`[onclick*="playAudio('\${id}'"]\`);
      
      if (audio.src) {
        try {
          audio.style.display = 'block';
          await audio.play();
        } catch (error) {
          console.error('Audio play error:', error);
          alert('播放失败: ' + error.message);
        }
        return;
      }
      
      // 更新按钮状态
      const originalText = button.innerHTML; // 使用innerHTML保存SVG图标
      button.innerHTML = '⏳';
      button.disabled = true;
      
      try {
        if (type === 'realtime') {
          // 实时播放类型：直接跳转到分享页面
          window.open(\`/share/\${id}\`, '_blank');
          button.innerHTML = originalText;
          button.disabled = false;
        } else {
          // 预存储类型：从API获取音频文件
          const response = await fetch(\`/api/audio/\${id}\`);
          if (response.ok) {
            const blob = await response.blob();
            
            // 验证 blob 是否有效
            if (blob.size === 0) {
              throw new Error('音频文件为空');
            }
            
            audio.src = URL.createObjectURL(blob);
            
            // 添加错误处理
            audio.addEventListener('error', (e) => {
              console.error('Audio error:', e);
              alert('音频播放失败，请重试');
            }, { once: true });
            
            audio.style.display = 'block';
            await audio.play();
            
            button.innerHTML = originalText;
            button.disabled = false;
          } else {
            const errorText = await response.text();
            throw new Error(\`HTTP \${response.status}: \${errorText}\`);
          }
        }
      } catch (error) {
        console.error('Audio loading error:', error);
        button.innerHTML = originalText;
        button.disabled = false;
        alert('播放失败: ' + error.message);
      }
    }
    
    function shareItem(id) {
      const shareUrl = \`\${window.location.origin}/share/\${id}\`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('分享链接已复制到剪贴板！');
      }).catch(() => {
        prompt('分享链接:', shareUrl);
      });
    }
    
    async function setPassword(id) {
      const currentPassword = prompt('设置访问密码（留空则移除密码）:');
      if (currentPassword === null) return; // 用户取消
      
      try {
        const apiKey = getCookie('apiKey');
        if (!apiKey) {
          alert('请先设置 API Key');
          return;
        }
        
        const response = await fetch('/api/set-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
          },
          body: JSON.stringify({ id, password: currentPassword })
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(result.hasPassword ? '密码设置成功！' : '密码已移除！');
          loadHistory(); // 刷新列表
        } else {
          const error = await response.json();
          alert('设置失败: ' + error.error.message);
        }
      } catch (error) {
        alert('设置失败: ' + error.message);
      }
    }
    
    async function deleteItem(id) {
      if (!confirm('确定要删除这个语音记录吗？此操作不可恢复！')) {
        return;
      }
      
      try {
        const apiKey = getCookie('apiKey');
        if (!apiKey) {
          alert('请先设置 API Key');
          return;
        }
        
        const response = await fetch('/api/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
          },
          body: JSON.stringify({ id })
        });
        
        if (response.ok) {
          alert('删除成功！');
          loadHistory(); // 刷新列表
        } else {
          const error = await response.json();
          alert('删除失败: ' + error.error.message);
        }
      } catch (error) {
        alert('删除失败: ' + error.message);
      }
    }
    
    async function clearAllHistory() {
      if (!confirm('确定要清空所有历史记录吗？此操作【无法恢复】！')) {
        return;
      }
      
      try {
        const apiKey = getCookie('apiKey');
        if (!apiKey) {
          alert('请先设置 API Key');
          return;
        }
        
        const response = await fetch('/api/clear-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
          }
        });
        
        if (response.ok) {
          alert('清空成功！');
          loadHistory(); // 刷新列表
        } else {
          const error = await response.json();
          alert('清空失败: ' + error.error.message);
        }
      } catch (error) {
        alert('清空失败: ' + error.message);
      }
    }
    
    function getCookie(name) {
      const value = \`; \${document.cookie}\`;
      const parts = value.split(\`; \${name}=\`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    }
    
    loadHistory();
  </script>
</body>
</html>`;
}

function getWebUIHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${SITE_NAME}</title>
    <style>
      :root { --primary-color: #007bff; --success-color: #28a745; --error-color: #dc3545; --light-gray: #f8f9fa; --gray: #6c757d; --border-color: #dee2e6; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--light-gray); color: #343a40; line-height: 1.6; display: flex; justify-content: center; padding: 2rem; margin: 0; }
      .container { max-width: 800px; width: 100%; background-color: #ffffff; padding: 2.5rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
      h1 { text-align: center; color: #333; margin-bottom: 2rem; font-weight: 700; }
      .form-group { margin-bottom: 1.5rem; }
      label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
      input, select, textarea, button { width: 100%; padding: 0.8rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; box-sizing: border-box; transition: all 0.2s; }
      input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15); }
      textarea { resize: vertical; min-height: 150px; }
      .textarea-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--gray); margin-top: 0.5rem; }
      #clear-text { background: none; border: none; color: var(--primary-color); cursor: pointer; padding: 0.2rem; width: auto; }
      .grid-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
      .slider-group { display: flex; align-items: center; gap: 1rem; }
      .slider-group input[type="range"] { flex-grow: 1; padding: 0; }
      .slider-group span { font-weight: 500; min-width: 40px; text-align: right; }
      
      /* 按钮布局优化 */
      .action-section { margin-top: 2rem; }
      .all-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
      
      /* 桌面端历史记录按钮居中 */
      @media (min-width: 769px) {
        .all-buttons { grid-template-columns: 1fr 1fr auto; align-items: center; }
        .secondary-btn { justify-self: center; min-width: 160px; }
      }
      .usage-tips { margin-top: 0.8rem; padding: 0.8rem; background-color: #e7f3ff; border-radius: 6px; font-size: 0.85rem; color: #004085; }
      
      button { font-weight: 600; cursor: pointer; }
      .primary-btn { background-color: var(--primary-color); color: white; border-color: var(--primary-color); }
      .stream-btn { background-color: var(--success-color); color: white; border-color: var(--success-color); }
      .secondary-btn { background-color: var(--gray); color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 8px; width: auto; }
      
      /* 移动端优化 */
      @media (max-width: 768px) {
        .container { padding: 1.5rem 1rem; margin: 0; border-radius: 8px; box-shadow: none; }
        body { padding: 0.5rem; }
        .action-section { margin-top: 1rem; }
        .all-buttons { grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        #btn-generate { grid-column: span 2; padding: 0.8rem; font-size: 1rem; }
        .primary-btn, .secondary-btn { padding: 0.7rem; font-size: 0.9rem; }
        .usage-tips { font-size: 0.85rem; padding: 0.8rem; margin-top: 1rem; border-radius: 6px; }
        .usage-tips ul { margin: 0.5rem 0 0 1.2rem; }
        .usage-tips li { margin-bottom: 0.4rem; }
        
        /* 使用提示布局修复 */
        .usage-tips > div:first-child { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; white-space: nowrap; }
        #dismiss-tips { flex-shrink: 0; margin-left: 0.5rem; padding: 5px; }
        
        /* 表单组件紧凑化 */
        .form-group { margin-bottom: 1.2rem; }
        details { padding: 1rem; margin-bottom: 1.2rem; }
        input[type="text"], input[type="password"], select, textarea { padding: 0.7rem 0.8rem; font-size: 16px; }
        h1 { margin-bottom: 1.5rem; font-size: 1.4rem; line-height: 1.3; }
      }
      #status { margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 500; display: none; }
      .status-info { background-color: #e7f3ff; color: #004085; }
      .status-success { background-color: #d4edda; color: #155724; }
      .status-error { background-color: #f8d7da; color: #721c24; }
      audio { width: 100%; margin-top: 1.5rem; display: none; }
      details { border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; background-color: var(--light-gray); }
      summary { font-weight: 600; cursor: pointer; }
      .checkbox-grid { margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.8rem; }
      .checkbox-grid label { display: flex; align-items: center; gap: 0.5rem; font-weight: normal; margin: 0; }
      .checkbox-grid input[type="checkbox"] { width: auto; margin: 0; flex-shrink: 0; }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>${SITE_NAME} (v1.0)</h1>
      <details id="api-config" open>
        <summary>API 配置</summary>
        <div class="form-group" style="margin-top: 1rem">
          <label for="baseUrl">API Base URL</label>
          <input type="text" id="baseUrl" value="" readonly/>
        </div>
        <div class="form-group">
          <label for="apiKey">API Key</label>
          <input type="password" id="apiKey" placeholder="输入部署时设置的 API Key" />
        </div>
        <button id="save-config" style="background-color: var(--primary-color); color: white;">保存并验证</button>
      </details>
      <div class="form-group">
        <label for="inputText">输入文本</label>
        <textarea id="inputText">你好，世界！[1] 这是一个 **Markdown** 格式的示例文本，包含链接 https://example.com 和 😊 表情符号。自定义关键词：ABC</textarea>
        <div class="textarea-footer">
          <span id="char-count">0 字符</span>
          <button id="clear-text">清除</button>
        </div>
      </div>
      <div class="grid-layout">
        <div class="form-group" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <div style="flex-grow: 1;">
            <label for="voice">选择音色 (Voice)</label>
            <select id="voice"></select>
          </div>
          <div style="flex-shrink: 0; align-self: flex-end; margin-bottom: 2px;">
            <button id="btn-preview-voice" class="secondary-btn" style="padding: 0.6rem 1rem;" title="试听当前音色">🔊 试听</button>
          </div>
        </div>
        
        <div id="custom-voice-config" style="display: none; grid-column: 1 / -1;">
          <div class="form-group">
            <label for="customVoiceName">自定义音色名称 (ShortName)</label>
            <input type="text" id="customVoiceName" placeholder="例如: zh-CN-XiaoxiaoNeural" />
            <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 0.3rem;">
              完整的音色标识符 
              <a href="https://learn.microsoft.com/zh-cn/azure/ai-services/speech-service/language-support?tabs=tts#multilingual-voices" target="_blank" style="color: var(--primary-color); text-decoration: none; margin-left: 0.5rem;">
                📋 查看完整音色列表
              </a>
            </small>
          </div>
          <div class="grid-layout" style="margin-top: 1rem;">
            <div class="form-group">
              <label for="voiceStyle">语音风格 (可选)</label>
              <select id="voiceStyle">
                <option value="">默认风格</option>
                <option value="angry">愤怒 (angry)</option>
                <option value="cheerful">开朗 (cheerful)</option>
                <option value="excited">兴奋 (excited)</option>
                <option value="friendly">友好 (friendly)</option>
                <option value="hopeful">希望 (hopeful)</option>
                <option value="sad">悲伤 (sad)</option>
                <option value="shouting">呐喊 (shouting)</option>
                <option value="terrified">恐惧 (terrified)</option>
                <option value="unfriendly">不友好 (unfriendly)</option>
                <option value="whispering">耳语 (whispering)</option>
                <option value="gentle">温柔 (gentle)</option>
                <option value="lyrical">抒情 (lyrical)</option>
                <option value="newscast">新闻播报 (newscast)</option>
                <option value="poetry-reading">诗歌朗诵 (poetry-reading)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="voiceRole">角色扮演 (可选)</label>
              <select id="voiceRole">
                <option value="">默认角色</option>
                <option value="Girl">女孩</option>
                <option value="Boy">男孩</option>
                <option value="YoungAdultFemale">年轻女性</option>
                <option value="YoungAdultMale">年轻男性</option>
                <option value="OlderAdultFemale">成年女性</option>
                <option value="OlderAdultMale">成年男性</option>
                <option value="SeniorFemale">老年女性</option>
                <option value="SeniorMale">老年男性</option>
              </select>
            </div>
            <div class="form-group">
              <label>风格强度 (可选)</label>
              <div class="slider-group">
                <input type="range" id="styleDegree" min="0.01" max="2" step="0.01" value="1" />
                <span id="styleDegreeValue">1.00</span>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>音频格式</label>
          <select id="audioFormat">
            <option value="mp3" selected>MP3 (最佳兼容性)</option>
            <option value="ogg">OGG OPUS (高音质/低体积)</option>
            <option value="wav">WAV (无损 PCM)</option>
          </select>
        </div>
        <div class="form-group">
          <label>语速</label>
          <div class="slider-group">
            <input type="range" id="speed" min="0.25" max="2.0" value="1.0" step="0.05" />
            <span id="speed-value">1.00</span>
          </div>
        </div>
        <div class="form-group">
          <label>音调</label>
          <div class="slider-group">
            <input type="range" id="pitch" min="0.5" max="1.5" value="1.0" step="0.05" />
            <span id="pitch-value">1.00</span>
          </div>
        </div>
      </div>
      <details>
        <summary>高级文本清理选项</summary>
        <div class="checkbox-grid">
          <label><input type="checkbox" id="removeMarkdown" checked />移除 Markdown</label>
          <label><input type="checkbox" id="removeEmoji" checked />移除 Emoji</label>
          <label><input type="checkbox" id="removeUrls" checked />移除 URL</label>
          <label><input type="checkbox" id="removeLineBreaks" checked />移除所有换行</label>
          <label><input type="checkbox" id="removeCitation" checked />移除引用标记[数字]</label>
        </div>
        <div class="form-group" style="margin-top: 1rem; margin-bottom: 0">
          <label for="customKeywords">自定义移除关键词 (逗号分隔)</label>
          <input type="text" id="customKeywords" placeholder="例如: ABC,XYZ" />
        </div>
      </details>
      <details id="ssml-details">
        <summary>SSML 高级编辑器 (可选)</summary>
        <div class="form-group" style="margin-top: 1rem;">
          <label for="ssmlEditor">输入完整 SSML XML (填写后将忽略上方文本和清理选项)</label>
          <textarea id="ssmlEditor" rows="6" placeholder="<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
  <voice name='zh-CN-XiaoxiaoNeural'>
    测试<break time='500ms'/>停顿和<emphasis level='strong'>强调</emphasis>
  </voice>
</speak>"></textarea>
          <div class="textarea-footer" style="justify-content: flex-start; gap: 10px; margin-top: 8px;">
            <button class="secondary-btn" id="btn-insert-break" style="padding: 4px 8px; font-size: 0.8rem; width: auto;">+ 停顿1秒</button>
            <button class="secondary-btn" id="btn-insert-emphasis" style="padding: 4px 8px; font-size: 0.8rem; width: auto;">+ 强调</button>
            <button class="secondary-btn" id="btn-ssml-template" style="padding: 4px 8px; font-size: 0.8rem; width: auto;">+ 基础模板</button>
            <small style="margin-left: auto; color: #666;">高级功能，需了解 SSML 语法</small>
          </div>
        </div>
      </details>
      <div class="action-section">
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 0.8rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
              <input type="checkbox" id="saveToHistory" style="width: auto; margin: 0;" />
              保存历史记录 (文本+录音)
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
              <input type="checkbox" id="saveAsRealtime" style="width: auto; margin: 0;" />
              保存实时播放 (文本+流播放)
            </label>
          </div>
          <div id="direct-save-buttons" style="display: none; text-align: center;">
            <button id="btn-direct-save" style="background-color: #17a2b8; color: white; padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer;">
              💾 直接保存到历史记录
            </button>
          </div>
        </div>
        
        <div class="all-buttons">
          <button id="btn-generate" class="primary-btn">生成语音 (标准)</button>
          <button id="btn-stream" class="primary-btn stream-btn">生成语音 (流式)</button>
          <button id="btn-history" class="secondary-btn">📚 历史记录</button>
        </div>
        
        <div id="usage-tips" class="usage-tips" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <strong>💡 使用提示：</strong>
            <button id="dismiss-tips" style="background: none; border: none; color: #004085; cursor: pointer; padding: 0; font-size: 1.2rem; line-height: 1;" title="我知道了，不再显示">×</button>
          </div>
          <ul style="margin: 0 0 0.5rem 1.2rem; padding: 0;">
            <li><strong>标准模式</strong>：适合所有设备，生成完整音频后播放，稳定可靠</li>
            <li><strong>流式模式</strong>：桌面端可快速开始播放，移动端自动切换为标准模式</li>
            <li><strong>长文本</strong>：超过1万字建议使用标准模式，更稳定</li>
          </ul>
          <div style="text-align: center;">
            <button id="confirm-tips" style="background-color: #004085; color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">我知道了</button>
          </div>
        </div>
      </div>
      <div id="status"></div>
      <audio id="audioPlayer" controls></audio>
      <details id="curl-details" style="margin-top: 2rem">
        <summary>cURL 命令示例</summary>
        <div style="position: relative; background-color: #212529; color: #f8f9fa; padding: 1.5rem; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', Consolas, monospace; font-size: 0.85rem; line-height: 1.4; overflow-x: auto;">
          <code id="curl-code">正在加载 cURL 示例...</code>
          <button id="copy-curl" style="position: absolute; top: 1rem; right: 1rem; background-color: #495057; color: white; border: none; border-radius: 5px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.8rem; width: auto;">复制</button>
        </div>
      </details>
      <footer style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: var(--gray);">
        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem;">
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray); text-decoration: none;">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub 项目
          </a>
          <span>|</span>
          <a href="https://github.com/zhikanyeye/edgetts-cloudflare-workers-webui-enhanced" target="_blank" style="color: var(--gray); text-decoration: none;">⭐ Star</a>
        </div>
      </footer>
    </main>
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const elements = {
          baseUrl: document.getElementById("baseUrl"),
          apiKey: document.getElementById("apiKey"),
          inputText: document.getElementById("inputText"),
          charCount: document.getElementById("char-count"),
          clearText: document.getElementById("clear-text"),
          voice: document.getElementById("voice"),
          speed: document.getElementById("speed"),
          speedValue: document.getElementById("speed-value"),
          pitch: document.getElementById("pitch"),
          pitchValue: document.getElementById("pitch-value"),
          btnGenerate: document.getElementById("btn-generate"),
          btnStream: document.getElementById("btn-stream"),
          btnHistory: document.getElementById("btn-history"),
          status: document.getElementById("status"),
          audioPlayer: document.getElementById("audioPlayer"),
          saveConfig: document.getElementById("save-config"),
          apiConfig: document.getElementById("api-config"),
          curlCode: document.getElementById("curl-code"),
          copyCurl: document.getElementById("copy-curl"),
          removeMarkdown: document.getElementById("removeMarkdown"),
          removeEmoji: document.getElementById("removeEmoji"),
          removeUrls: document.getElementById("removeUrls"),
          removeLineBreaks: document.getElementById("removeLineBreaks"),
          removeCitation: document.getElementById("removeCitation"),
          customKeywords: document.getElementById("customKeywords"),
          saveToHistory: document.getElementById("saveToHistory"),
          saveAsRealtime: document.getElementById("saveAsRealtime"),
          directSaveButtons: document.getElementById("direct-save-buttons"),
          btnDirectSave: document.getElementById("btn-direct-save"),
          customVoiceConfig: document.getElementById("custom-voice-config"),
          customVoiceName: document.getElementById("customVoiceName"),
          voiceStyle: document.getElementById("voiceStyle"),
          voiceRole: document.getElementById("voiceRole"),
          styleDegree: document.getElementById("styleDegree"),
          styleDegreeValue: document.getElementById("styleDegreeValue"),
          usageTips: document.getElementById("usage-tips"),
          dismissTips: document.getElementById("dismiss-tips"),
          confirmTips: document.getElementById("confirm-tips"),
          btnPreviewVoice: document.getElementById("btn-preview-voice"),
          audioFormat: document.getElementById("audioFormat"),
          ssmlEditor: document.getElementById("ssmlEditor"),
          btnInsertBreak: document.getElementById("btn-insert-break"),
          btnInsertEmphasis: document.getElementById("btn-insert-emphasis"),
          btnSsmlTemplate: document.getElementById("btn-ssml-template"),
        };

        // 将服务器端的 VOICE_CATALOG 传递给前端
        const VOICE_CATALOG = ${JSON.stringify(VOICE_CATALOG)};
        
        // 渲染音色选择器
        const renderVoiceSelector = () => {
          let html = '';
          for (const [groupStr, voices] of Object.entries(VOICE_CATALOG)) {
            html += \`<optgroup label="\${groupStr}">\`;
            voices.forEach(v => {
              const flag = groupStr.split(' ')[0]; // 提取旗帜 emoji
              html += \`<option value="\${v.name}" data-preview="\${v.preview || ''}">\${flag} \${v.label} (\${v.name})</option>\`;
            });
            html += \`</optgroup>\`;
          }
          html += \`<optgroup label="⚙️ 其他"><option value="custom">🎛️ 自定义音色配置</option></optgroup>\`;
          elements.voice.innerHTML = html;
          // 默认选中第一个中文女声
          elements.voice.value = 'zh-CN-XiaoxiaoNeural';
        };
        renderVoiceSelector();

        const setCookie = (name, value, days = 30) => {
          const d = new Date();
          d.setTime(d.getTime() + (days*24*60*60*1000));
          document.cookie = name + "=" + encodeURIComponent(value) + ";expires="+ d.toUTCString() + ";path=/";
        };
        const getCookie = (name) => {
          const ca = decodeURIComponent(document.cookie).split(';');
          for(let c of ca) {
            c = c.trim();
            if (c.startsWith(name + "=")) return c.substring(name.length + 1);
          }
          return "";
        };

        // 使用提示管理
        const initUsageTips = () => {
          const tipsHidden = getCookie("usageTipsHidden");
          if (!tipsHidden) {
            elements.usageTips.style.display = "block";
          }
        };

        const hideUsageTips = () => {
          elements.usageTips.style.display = "none";
          setCookie("usageTipsHidden", "true", 365); // 记住一年
        };

        // SSML 快捷按钮处理
        elements.btnInsertBreak.addEventListener("click", () => {
          const editor = elements.ssmlEditor;
          const cursorPos = editor.selectionStart;
          const textBefore = editor.value.substring(0, cursorPos);
          const textAfter = editor.value.substring(cursorPos, editor.value.length);
          editor.value = textBefore + "<break time='1s'/>" + textAfter;
          editor.focus();
        });
        
        elements.btnInsertEmphasis.addEventListener("click", () => {
          const editor = elements.ssmlEditor;
          const cursorPos = editor.selectionStart;
          const cursorEnd = editor.selectionEnd;
          const textBefore = editor.value.substring(0, cursorPos);
          const selectedText = editor.value.substring(cursorPos, cursorEnd);
          const textAfter = editor.value.substring(cursorEnd, editor.value.length);
          editor.value = textBefore + "<emphasis level='strong'>" + (selectedText || '强调的文本') + "</emphasis>" + textAfter;
          editor.focus();
        });

        elements.btnSsmlTemplate.addEventListener("click", () => {
          const voiceConfig = getVoiceConfig();
          elements.ssmlEditor.value = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>\\n" +
"  <voice name='" + voiceConfig.voice + "'>\\n" +
"    <mstts:express-as style='" + (voiceConfig.style || "general") + "' styledegree='" + (voiceConfig.styleDegree || 1) + "'>\\n" +
"      在此输入要朗读的文本。\\n" +
"    </mstts:express-as>\\n" +
"  </voice>\\n" +
"</speak>";
        });

        // 试听音色
        elements.btnPreviewVoice.addEventListener("click", () => {
          const isCustom = elements.voice.value === "custom";
          if (isCustom && !elements.customVoiceName.value.trim()) {
            updateStatus("请先输入自定义音色名称", "error");
            return;
          }
          
          let previewText = "这是一个语音试听内容，测试效果。";
          if (!isCustom) {
            const selectedOption = elements.voice.options[elements.voice.selectedIndex];
            previewText = selectedOption.dataset.preview || previewText;
          }

          const originalText = elements.inputText.value;
          const originalSsml = elements.ssmlEditor.value;
          elements.inputText.value = previewText;
          elements.ssmlEditor.value = ""; // 临时清空以确保不用 SSML
          
          generateSpeech(false, 0).finally(() => {
            elements.inputText.value = originalText;
            elements.ssmlEditor.value = originalSsml;
          });
        });

        const updateStatus = (message, type, persistent = false) => {
          elements.status.textContent = message;
          elements.status.className = \`status-\${type}\`;
          elements.status.style.display = "block";
          if (!persistent) {
              setTimeout(() => elements.status.style.display = "none", 3000);
          }
        };

        const updateCurlExample = () => {
          const baseUrl = elements.baseUrl.value;
          const apiKey = elements.apiKey.value.trim();
          let authHeader = apiKey ? \`--header 'Authorization: Bearer \${apiKey}' \\\\\` : '# API Key not set, authorization header is commented out';
          
          const voiceValue = elements.voice.value === 'custom' ? 
            (elements.customVoiceName.value.trim() || 'zh-CN-XiaoxiaoNeural') : 
            elements.voice.value;
          
          const curlCommand = \`# OpenAI Compatible Request
curl --location '\${baseUrl}/v1/audio/speech' \\\\
\${authHeader}
--header 'Content-Type: application/json' \\\\
--data '{
    "model": "tts-1",
    "voice": "\${voiceValue}",
    "input": "你好，世界！这是一个测试语音合成的示例。",
    "speed": \${elements.speed.value},
    "pitch": \${elements.pitch.value}
}' \\\\
--output speech.mp3

# 高级功能示例 (自定义音色配置)
curl --location '\${baseUrl}/v1/audio/speech' \\\\
\${authHeader}
--header 'Content-Type: application/json' \\\\
--data '{
    "model": "tts-1",
    "voice": "zh-CN-XiaoxiaoNeural",
    "input": "这是使用高级配置的语音合成示例。",
    "style": "cheerful",
    "role": "YoungAdultFemale",
    "styleDegree": 1.5,
    "speed": 1.2,
    "pitch": 1.1,
    "cleaning_options": {
        "remove_markdown": true,
        "remove_emoji": true,
        "remove_urls": true,
        "remove_line_breaks": false
    }
}' \\\\
--output advanced.mp3

# 流式请求示例 (长文本优化)
curl --location '\${baseUrl}/v1/audio/speech' \\\\
\${authHeader}
--header 'Content-Type: application/json' \\\\
--data '{
    "model": "tts-1",
    "voice": "alloy",
    "input": "这是一个流式请求的示例，适用于较长的文本内容。",
    "stream": true
}' \\\\
--output streaming.mp3\`;
          elements.curlCode.textContent = curlCommand;
        };

        // Event listener for Save and Validate button
        elements.saveConfig.addEventListener("click", async () => {
          const key = elements.apiKey.value.trim();
          if (!key) {
            updateStatus("请输入 API Key", "error");
            return;
          }

          // 简单保存，不进行验证（验证会在实际使用时进行）
          setCookie("apiKey", key);
          updateStatus("API Key 已保存！", "success");
          elements.apiConfig.open = false;
          updateCurlExample();
        });

        // 设备检测函数
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Generate speech function with retry mechanism
        const generateSpeech = async (isStream = false, retryCount = 0) => {
          const apiKey = elements.apiKey.value.trim();
          const text = elements.inputText.value.trim();
          const audioFormat = elements.audioFormat.value;

          if (!apiKey) {
            updateStatus("请先在 API 配置中输入 API Key", "error");
            elements.apiConfig.open = true;
            return;
          }
          if (!text) {
            updateStatus("请输入要合成的文本", "error");
            return;
          }

          // 【核心优化】移动端流式降级为标准模式
          if (isStream && isMobile) {
            console.log("Mobile device detected. Downgrading stream to standard request for compatibility.");
            isStream = false;
          }
          if (isStream && audioFormat !== "mp3") {
            console.log(`Streaming is limited to mp3 in the current WebUI. Downgrading ${audioFormat} to standard request.`);
            isStream = false;
          }

          const maxRetries = 2;
          const statusMessage = retryCount > 0 ? 
            \`正在重试生成语音... (第\${retryCount + 1}次尝试)\` : 
            (isStream ? "正在生成流式语音..." : "正在生成语音...");
          
          updateStatus(statusMessage, "info", true);
          elements.audioPlayer.style.display = "none";
          elements.audioPlayer.src = "";

          try {
            const voiceConfig = getVoiceConfig();
            const requestBody = {
              model: "tts-1", // 符合 OpenAI 标准
              input: text,
              voice: voiceConfig.voice,
              speed: parseFloat(elements.speed.value), 
              pitch: parseFloat(elements.pitch.value), 
              style: voiceConfig.style,
              role: voiceConfig.role,
              styleDegree: voiceConfig.styleDegree,
              stream: isStream,
              response_format: audioFormat,
              ssml: elements.ssmlEditor.value.trim(),
              cleaning_options: {
                remove_markdown: elements.removeMarkdown.checked, remove_emoji: elements.removeEmoji.checked,
                remove_urls: elements.removeUrls.checked, remove_line_breaks: elements.removeLineBreaks.checked,
                remove_citation_numbers: elements.removeCitation.checked, custom_keywords: elements.customKeywords.value,
              },
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45秒超时

            const response = await fetch(\`\${elements.baseUrl.value}/v1/audio/speech\`, {
              method: "POST",
              headers: { "Authorization": \`Bearer \` + apiKey, "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: { message: \`服务器错误: \${response.statusText}\` } }));
              throw new Error(errorData.error.message);
            }

            if (isStream) {
              const mediaSource = new MediaSource();
              elements.audioPlayer.src = URL.createObjectURL(mediaSource);
              elements.audioPlayer.style.display = "block";
              elements.audioPlayer.play().catch(e => {});
              
              mediaSource.addEventListener("sourceopen", () => {
                const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
                const reader = response.body.getReader();
                
                const pump = () => {
                  reader.read().then(({ done, value }) => {
                    if (done) {
                      if (!sourceBuffer.updating) mediaSource.endOfStream();
                      updateStatus("流式播放完毕！", "success");
                      return;
                    }
                    const append = () => sourceBuffer.appendBuffer(value);
                    if (sourceBuffer.updating) {
                      sourceBuffer.addEventListener("updateend", append, { once: true });
                    } else {
                      append();
                    }
                  });
                };
                sourceBuffer.addEventListener("updateend", pump);
                pump();
                
                // 流式播放完成后的保存逻辑
                // 流式播放完成，不自动保存
                // 保存功能由"直接保存"按钮单独处理
              }, { once: true });
            } else {
              const blob = await response.blob();
              const audioUrl = URL.createObjectURL(blob);
              elements.audioPlayer.src = audioUrl;
              elements.audioPlayer.style.display = "block";
              elements.audioPlayer.play();
              updateStatus("语音生成成功！", "success");
              
              // 生成语音按钮只负责生成和播放，不自动保存
              // 保存功能由"直接保存"按钮单独处理
            }

          } catch (error) {
            console.error('Speech generation error:', error);
            
            // 检查是否应该重试
            const shouldRetry = retryCount < maxRetries && (
              error.name === 'AbortError' || 
              error.message.includes('Failed to get endpoint') ||
              error.message.includes('502') ||
              error.message.includes('503') ||
              error.message.includes('timeout')
            );
            
            if (shouldRetry) {
              console.log(\`Retrying speech generation, attempt \${retryCount + 1}\`);
              setTimeout(() => {
                generateSpeech(isStream, retryCount + 1);
              }, 2000 * (retryCount + 1)); // 递增延迟
            } else {
              let errorMessage = error.message;
              if (error.name === 'AbortError') {
                errorMessage = '请求超时，请检查网络连接后重试';
              } else if (errorMessage.includes('Failed to get endpoint')) {
                errorMessage = 'TTS 服务暂时不可用，请稍后重试';
              }
              updateStatus(\`错误: \${errorMessage}\`, "error", true);
            }
          }
        };

        // Convert ArrayBuffer to Base64 safely
        const arrayBufferToBase64 = async (buffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunkSize = 8192;
          
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          
          return btoa(binary);
        };

        // Save as realtime play function
        const saveAsRealtimePlay = async (requestBody, apiKey) => {
          try {
            updateStatus("正在保存为实时播放...", "info", true);
            
            const voiceConfig = getVoiceConfig();
            
            // 创建实时播放的元数据（不包含音频文件）
            const realtimeData = {
              text: requestBody.input,
              voice: voiceConfig.voice,
              speed: requestBody.speed,
              pitch: requestBody.pitch,
              style: voiceConfig.style,
              role: voiceConfig.role,
              styleDegree: voiceConfig.styleDegree,
              cleaningOptions: requestBody.cleaning_options,
              type: 'realtime' // 标记为实时播放类型
            };
            
            const response = await fetch('/api/save-realtime', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(realtimeData)
            });
            
            if (response.ok) {
              const result = await response.json();
              const deviceInfo = isMobile ? '移动端将使用标准播放模式' : 'PC端将使用流式播放模式';
              updateStatus(\`✅ 实时播放已保存！\${deviceInfo}，分享链接: \${window.location.origin}\${result.shareUrl}\`, "success");
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error?.message || '保存失败');
            }
          } catch (error) {
            updateStatus(\`保存实时播放失败: \${error.message}\`, "error");
          }
        };

        // Generate realtime play link function (deprecated)
        const generateRealtimePlayLink = (requestBody) => {
          try {
            const voiceConfig = getVoiceConfig();
            const shareParams = {
              text: encodeURIComponent(requestBody.input),
              voice: voiceConfig.voice,
              speed: requestBody.speed,
              pitch: requestBody.pitch,
              style: voiceConfig.style,
              role: voiceConfig.role,
              styleDegree: voiceConfig.styleDegree
            };
            
            const shareUrl = \`\${window.location.origin}/play?\${new URLSearchParams(shareParams)}\`;
            
            // 设备检测和用户提示
            const deviceInfo = isMobile ? '移动端将使用标准播放模式' : 'PC端将使用流式播放模式';
            
            // 复制到剪贴板并显示友好提示
            navigator.clipboard.writeText(shareUrl).then(() => {
              updateStatus(\`🔗 实时播放链接已复制！\${deviceInfo}，接收者需耐心等待语音生成\`, "success");
              console.log('Realtime play URL:', shareUrl);
            }).catch(() => {
              // 如果复制失败，显示链接让用户手动复制
              updateStatus(\`🔗 实时播放链接生成成功！\${deviceInfo}\`, "success");
              prompt('实时播放链接（按需生成）:', shareUrl);
            });
            
          } catch (error) {
            updateStatus(\`生成分享链接失败: \${error.message}\`, "error");
          }
        };

        // Save to history function
        const saveToHistory = async (requestBody, audioBlob, apiKey) => {
          try {
            updateStatus("正在保存到历史记录...", "info", true);
            
            // Create FormData to send binary data directly
            const formData = new FormData();
            formData.append('text', requestBody.input);
            formData.append('voice', requestBody.voice); // 使用 voice 而不是 model
            formData.append('audioFormat', requestBody.response_format || 'mp3');
            formData.append('speed', requestBody.speed.toString());
            formData.append('pitch', requestBody.pitch.toString());
            formData.append('cleaningOptions', JSON.stringify(requestBody.cleaning_options));
            formData.append('audioFile', audioBlob, `audio.${requestBody.response_format || 'mp3'}`);
            
            const response = await fetch('/api/save', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              body: formData  // No Content-Type header needed for FormData
            });
            
            if (response.ok) {
              const result = await response.json();
              updateStatus(\`已保存！分享链接: \${window.location.origin}\${result.shareUrl}\`, "success");
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error?.message || '保存失败');
            }
          } catch (error) {
            updateStatus(\`保存失败: \${error.message}\`, "error");
          }
        };

        // Event listeners
        elements.btnGenerate.addEventListener("click", () => generateSpeech(false));
        elements.btnStream.addEventListener("click", () => generateSpeech(true));
        elements.btnHistory.addEventListener("click", async () => {
          const apiKey = getCookie("apiKey");
          if (!apiKey) {
            updateStatus("请先设置 API Key 才能查看历史记录", "error");
            elements.apiConfig.open = true;
            return;
          }
          
          // 验证API Key是否有效
          try {
            const response = await fetch('/api/history', {
              headers: { 'Authorization': \`Bearer \${apiKey}\` }
            });
            
            if (!response.ok) {
              updateStatus("API Key 无效，无法访问历史记录", "error");
              elements.apiConfig.open = true;
              return;
            }
            
            window.open('/history', '_blank');
          } catch (error) {
            updateStatus("验证 API Key 失败，请检查网络连接", "error");
          }
        });
        
        // 使用提示事件监听
        elements.dismissTips.addEventListener("click", hideUsageTips);
        elements.confirmTips.addEventListener("click", hideUsageTips);
        
        // 保存选项互斥逻辑：勾选时二选一，并显示/隐藏直接保存按钮
        const updateDirectSaveButton = () => {
          const showButton = elements.saveToHistory.checked || elements.saveAsRealtime.checked;
          elements.directSaveButtons.style.display = showButton ? 'block' : 'none';
        };
        
        elements.saveToHistory.addEventListener("change", () => {
          if (elements.saveToHistory.checked && elements.saveAsRealtime.checked) {
            elements.saveAsRealtime.checked = false;
          }
          updateDirectSaveButton();
        });
        
        elements.saveAsRealtime.addEventListener("change", () => {
          if (elements.saveAsRealtime.checked && elements.saveToHistory.checked) {
            elements.saveToHistory.checked = false;
          }
          updateDirectSaveButton();
        });
        
        // 直接保存按钮点击事件
        elements.btnDirectSave.addEventListener("click", async () => {
          const apiKey = elements.apiKey.value.trim();
          const text = elements.inputText.value.trim();

          if (!apiKey) {
            updateStatus("请先在 API 配置中输入 API Key", "error");
            elements.apiConfig.open = true;
            return;
          }
          if (!text) {
            updateStatus("请输入要合成的文本", "error");
            return;
          }

          const voiceConfig = getVoiceConfig();
          const requestBody = {
            model: "tts-1",
            input: text,
            voice: voiceConfig.voice,
            speed: parseFloat(elements.speed.value),
            pitch: parseFloat(elements.pitch.value),
            style: voiceConfig.style,
            role: voiceConfig.role,
            styleDegree: voiceConfig.styleDegree,
            stream: false, // 直接保存使用标准模式
            response_format: elements.audioFormat.value,
            cleaning_options: {
              remove_markdown: elements.removeMarkdown.checked,
              remove_emoji: elements.removeEmoji.checked,
              remove_urls: elements.removeUrls.checked,
              remove_line_breaks: elements.removeLineBreaks.checked,
              remove_citation_numbers: elements.removeCitation.checked,
              custom_keywords: elements.customKeywords.value,
            },
          };

          try {
            updateStatus("正在直接保存到历史记录...", "info", true);
            
            if (elements.saveToHistory.checked) {
              // 生成音频并保存到历史记录
              const response = await fetch(\`\${elements.baseUrl.value}/v1/audio/speech\`, {
                method: "POST",
                headers: { "Authorization": \`Bearer \` + apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              });
              
              if (response.ok) {
                const blob = await response.blob();
                await saveToHistory(requestBody, blob, apiKey);
              } else {
                throw new Error('生成音频失败');
              }
            }
            
            if (elements.saveAsRealtime.checked) {
              // 直接保存为实时播放
              await saveAsRealtimePlay(requestBody, apiKey);
            }
            
          } catch (error) {
            updateStatus(\`直接保存失败: \${error.message}\`, "error");
          }
        });
        
        elements.copyCurl.addEventListener("click", () => {
          navigator.clipboard.writeText(elements.curlCode.textContent).then(() => {
            elements.copyCurl.textContent = "已复制!";
            setTimeout(() => elements.copyCurl.textContent = "复制", 2000);
          });
        });
        elements.inputText.addEventListener("input", () => { 
          elements.charCount.textContent = \`\${elements.inputText.value.length} 字符\`;
          updateCurlExample();
        });
        elements.clearText.addEventListener("click", () => { 
          elements.inputText.value = ""; 
          elements.charCount.textContent = "0 字符"; 
        });
        // Handle custom voice configuration visibility
        const toggleCustomVoiceConfig = () => {
          const isCustom = elements.voice.value === 'custom';
          elements.customVoiceConfig.style.display = isCustom ? 'block' : 'none';
        };

        // Get effective voice configuration
        const getVoiceConfig = () => {
          if (elements.voice.value === 'custom') {
            return {
              voice: elements.customVoiceName.value.trim() || 'zh-CN-XiaoxiaoNeural',
              style: elements.voiceStyle.value || 'general',
              role: elements.voiceRole.value || '',
              styleDegree: parseFloat(elements.styleDegree.value)
            };
          } else {
            return {
              voice: elements.voice.value,
              style: 'general',
              role: '',
              styleDegree: 1.0
            };
          }
        };

        const updateUI = () => {
          elements.speedValue.textContent = parseFloat(elements.speed.value).toFixed(2);
          elements.pitchValue.textContent = parseFloat(elements.pitch.value).toFixed(2);
          elements.styleDegreeValue.textContent = parseFloat(elements.styleDegree.value).toFixed(2);
          toggleCustomVoiceConfig();
          updateCurlExample();
        };
        
        ['speed', 'voice', 'apiKey'].forEach(id => elements[id].addEventListener('input', updateUI));
        ['pitch'].forEach(id => elements[id].addEventListener('input', () => elements.pitchValue.textContent = parseFloat(elements.pitch.value).toFixed(2)));
        elements.styleDegree.addEventListener('input', () => elements.styleDegreeValue.textContent = parseFloat(elements.styleDegree.value).toFixed(2));


        // Initial page setup
        elements.baseUrl.value = window.location.origin;
        const savedApiKey = getCookie("apiKey");
        if (savedApiKey) {
            elements.apiKey.value = savedApiKey;
            elements.apiConfig.open = false;
        } else {
            elements.apiConfig.open = true;
        }
        elements.charCount.textContent = \`\${elements.inputText.value.length} 字符\`;
        
        // 初始化使用提示
        initUsageTips();
        
        updateUI();
      });
    </script>
  </body>
</html>`;
}
