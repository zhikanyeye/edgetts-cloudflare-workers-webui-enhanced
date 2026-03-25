# EdgeTTS WebUI Enhanced

> **v1.0**

一个部署在 Cloudflare Pages 上的高性能文本转语音（TTS）代理服务，将微软 Edge TTS 封装成兼容 OpenAI API 的接口。

## ✨ 主要特性

- **🚀 OpenAI 兼容**: 完全模拟 OpenAI 的 `/v1/audio/speech` 接口
- **🗣️ 高质量音色**: 利用微软 Edge TTS 的自然神经网络语音（支持中/英/日/韩等 **20+ 多语言音色**）
- **🔊 音色试听功能**: 内置 WebUI 支持一键试听各语言专属预览音频
- **📝 SSML 高级控制**: 独家支持直通输入 SSML 进行停顿、强调等精细化控制
- **🎵 多格式输出**: 支持指定 MP3、OGG(Opus)、WAV 等多种音频输出格式
- **⚡ 流式播放**: 支持流式和标准两种响应模式，降低长文本延迟
- **🧠 智能文本清理**: 自动处理 Markdown、Emoji、URL、引用标记等
- **🗄️ 智能历史管理**: 支持按标签（实时/预存/加密）过滤记录，支持一键清空
- **📖 有声书功能**: 支持 Markdown 格式分享，自动优化 TTS 文本转换
- **🔗 跨设备分享**: 带密码保护的分享链接，可作为临时信息传递工具
- **🔐 安全访问**: API 密钥验证，确保服务安全
- **📱 移动端适配**: WebUI 针对手机屏幕进行了专门的优化排列
- **💻 内置 WebUI**: 功能完整的响应式测试界面，无需编程即可使用

## 🚀 快速部署

### 1. 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击 **Workers 和 Pages** → **创建应用程序** → **Pages** → **上传资产**
3. 直接拖拽 `_worker.js` 单文件上传即可，**无需压缩包**（也支持 zip 包，需确保文件在根目录）
4. 在添加变量和 KV 绑定后，务必**重新部署一次**才能生效！

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
| `input` | string | **必需** | 要转换的文本 (当 `ssml` 非空时，此字段失效) |
| `voice` | string | `"alloy"` | 音色选择（支持 OpenAI 映射名称或 Azure 原始音色名） |
| `speed` | number | `1.0` | 语速 (0.25-2.0) |
| `pitch` | number | `1.0` | 音调 (0.5-1.5) |
| `response_format`| string | `"mp3"` | 返回格式，支持 `mp3`、`ogg`、`wav` |
| `stream` | boolean | `false` | 是否流式响应 |
| `ssml` | string | `""` | 可选直接传入 SSML XML 数据进行高级渲染 |
| `cleaning_options` | object | `{...}` | 文本清理选项 |

### 智能用户ID机制
- **自动生成**: 基于部署域名自动生成唯一的16位十六进制用户ID
- **避免冲突**: 每个 Cloudflare Pages 域名都有独特的用户ID，防止多部署间的冲突
- **稳定性**: 同一域名的用户ID保持固定，不会频繁变化
- **兼容性**: 如果域名解析失败，自动回退到默认用户ID

### 音色选择

支持两大类音色：
1. **Azure 原生名**：如 `zh-CN-XiaoxiaoNeural`, `en-US-AriaNeural`, `ja-JP-NanamiNeural` 等
2. **OpenAI 兼容名**（自动映射为中文音色）：
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

- **`_worker.js`**: 核心服务文件，包含完整功能（单文件部署，无需其他文件）

## 📋 更新日志

### v1.0
- 🚀 **全面功能升级**：
  - 新增多语言音色库及 WebUI 分组选择器
  - 新增 `试听` 按钮一键获取音色 Demo
  - 新增对返回格式 `mp3` / `ogg` / `wav` 的支持映射
  - 添加前台 SSML 高级编辑器（支持插入停顿/强调）
  - 历史记录面板添加标签过滤与整体清空能力
  - 全面加强移动端手机屏幕布局与控件间距优化
- 🔒 **安全加固**：修复 `/api/history` 等历史记录端点调用时缺少 Bearer Auth 头的验证漏洞与错误抛出

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
