# CF-TTS Proxy Server (v1.2)

一个部署在 Cloudflare Pages 上的高性能文本转语音（TTS）代理服务，将微软 Edge TTS 封装成兼容 OpenAI API 的接口。

## ✨ 主要特性

- **🚀 OpenAI 兼容**: 完全模拟 OpenAI 的 `/v1/audio/speech` 接口
- **🗣️ 高质量音色**: 利用微软 Edge TTS 的自然神经网络语音
- **⚡ 流式播放**: 支持流式和标准两种响应模式，降低长文本延迟
- **🧠 智能文本清理**: 自动处理 Markdown、Emoji、URL、引用标记等
- **🗄️ 智能历史记录**: 支持两种保存模式
  - **音频+文本保存**: 完整音频文件存储，速度快，适合有声书制作
  - **文本+流式播放**: 仅保存文本，实时生成音频，不占存储空间
- **📖 有声书功能**: 支持 Markdown 格式分享，自动优化 TTS 文本转换
- **🔗 跨设备分享**: 带密码保护的分享链接，可作为临时信息传递工具
- **🔐 安全访问**: API 密钥验证，确保服务安全
- **🆔 智能用户ID**: 基于部署域名自动生成唯一用户ID，避免多部署冲突
- **💻 内置 WebUI**: 功能完整的测试界面，无需编程即可使用

## 🚀 快速部署

### 1. 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击 **Workers 和 Pages** → **创建应用程序** → **Pages** → **上传资产**
3. 上传 [v1.2 Release](https://github.com/samni728/edgetts-cloudflare-workers-webui/releases/tag/v1.2) 在添加变量和 kv 后务必在重新部署一次才能生效！

### 2. 配置环境变量

#### 设置 API 密钥
1. 在项目设置中找到 **环境变量**
2. 添加变量：
   - **变量名**: `API_KEY`
   - **值**: 任意字符串（用于 API 访问控制）
   - **加密**: ✅ 勾选



### 3. 配置 KV 存储（必需）

#### 创建 KV 存储
1. 在 Cloudflare Dashboard 中，进入 **Workers 和 Pages** → **KV**
2. 点击 **创建命名空间**
3. 命名空间名称：`TTS_HISTORY`
4. 点击 **添加**



#### 绑定 KV 到 Pages 项目
1. 进入你的 Pages 项目设置
2. 找到 **设置** → **函数** → **KV 命名空间绑定**
3. 点击 **添加绑定**
4. 配置：
   - **变量名**: `TTS_HISTORY`
   - **KV 命名空间**: 选择刚创建的 `TTS_HISTORY`
5. 点击 **保存并部署**


## 📖 使用方法

### WebUI 界面
访问你的 Pages 域名，即可使用内置的 WebUI 界面进行测试。

### API 调用示例

```bash
curl -X POST "https://your-domain.pages.dev/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "voice": "shimmer",
    "input": "你好，世界！",
    "stream": false
  }' --output audio.mp3
```

### 主要参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | string | `"tts-1"` | 模型 ID |
| `input` | string | **必需** | 要转换的文本 |
| `voice` | string | `"alloy"` | 音色选择 |
| `speed` | number | `1.0` | 语速 (0.25-2.0) |
| `pitch` | number | `1.0` | 音调 (0.5-1.5) |
| `stream` | boolean | `false` | 是否流式响应 |
| `cleaning_options` | object | `{...}` | 文本清理选项 |

### 智能用户ID机制
- **自动生成**: 基于部署域名自动生成唯一的16位十六进制用户ID
- **避免冲突**: 每个 Cloudflare Pages 域名都有独特的用户ID，防止多部署间的冲突
- **稳定性**: 同一域名的用户ID保持固定，不会频繁变化
- **兼容性**: 如果域名解析失败，自动回退到默认用户ID

### 音色选择

#### OpenAI 兼容音色
- `shimmer` - 温柔女声
- `alloy` - 专业男声  
- `fable` - 激情男声
- `onyx` - 活泼女声
- `nova` - 阳光男声
- `echo` - 东北女声

#### 高级参数
- `style` - 语音风格（general, chat, news, etc.）
- `role` - 角色扮演（YoungAdultFemale, etc.）
- `styleDegree` - 风格强度 (0.01-2.0)

### 文本清理选项

```json
{
  "remove_markdown": true,
  "remove_emoji": true,
  "remove_urls": true,
  "remove_line_breaks": false,
  "remove_citation_numbers": true,
  "custom_keywords": "关键词1,关键词2"
}
```

### 流式播放示例

```bash
curl -X POST "https://your-domain.pages.dev/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "voice": "nova",
    "input": "这是一个长文本示例...",
    "stream": true
  }' --output streaming.mp3
```

## 项目文件

- **`_worker.js`**: 核心服务文件，包含完整功能
- **`screenshorts/`**: 配置示例图片
- **`tts_list/`**: 完整音色列表文件

## ⚠️ 限制说明

- **字符数限制**: 单次请求约 12 万字符
- **免费套餐**: 适用于 Cloudflare 免费套餐
- **首次部署**: 可能需要等待 1-2 分钟初始化

## 🔗 相关链接
- [Edge TTS 音色列表](https://learn.microsoft.com/zh-cn/azure/ai-services/speech-service/language-support?tabs=tts#multilingual-voices)

## ⚖️ 使用声明

- 本服务基于微软 Edge TTS 技术，提供文本转语音功能
- 用户数据存储在用户自己的 Cloudflare KV 中，完全由用户控制
- 请遵守相关法律法规，不得用于违法用途
- 使用本服务即表示您同意相关条款
