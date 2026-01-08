# YUI ChatBox - 智能对话助手

<div align="center">

一个功能强大、易于使用的 AI 对话应用，支持多模型源管理、推理过程可视化和流式响应。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)

</div>

## ✨ 核心特性

### 🎯 多模型源管理
- **灵活配置**：支持同时配置多个模型源（OpenAI、DeepSeek、本地 vLLM 等）
- **自动检测**：一键检测模型源中可用的模型
- **模型分类**：支持 LLM、嵌入模型、重排序模型、多模态模型分类
- **推理模型标记**：可标记推理模型，自动处理推理过程显示

### 🧠 推理模型支持
- **自动识别**：支持 DeepSeek Reasoner、Qwen Thinking 等推理模型
- **过程可视化**：推理过程自动折叠在琥珀色区域，可展开查看
- **三种检测方式**：
  - API 返回 `reasoning_content` 字段
  - 模型配置为推理模型
  - 内容包含 `<think>...</think>` 标签
- **流式友好**：实时分离推理内容和最终答案

### 💬 对话管理
- **多会话**：支持无限数量的对话会话
- **实时流式**：Server-Sent Events (SSE) 实现打字机效果
- **消息操作**：编辑用户消息、重新生成助手回答、复制内容
- **会话管理**：置顶、归档、重命名、删除、搜索对话

### ⚙️ 高级配置
- **模型参数**：Temperature、Top-P、Max Tokens、System Prompt
- **额外参数**：灵活添加自定义参数（支持文本、JSON、布尔、数字类型）
  - `extra_body` 自动展开（兼容 OpenAI Python SDK 行为）
  - 支持 `top_k`、`repeat_penalty`、`min_p` 等高级参数
  - 每个参数可独立启用/禁用

### 🎨 用户界面
- **深色/浅色主题**：自动保存偏好
- **Markdown 渲染**：支持 GFM、代码高亮、表格、链接等
- **代码高亮**：基于 Prism.js，支持数十种编程语言
- **响应式设计**：适配桌面和移动设备

### 💾 数据持久化
- **本地存储**：所有对话自动保存到 localStorage
- **导入/导出**：支持导出单个或全部对话为 JSON
- **无服务器**：数据完全存储在浏览器本地

## 🚀 快速开始

### 环境要求
- Node.js 18+ 和 npm
- Python 3.11+
- 一个 OpenAI 兼容的 API 端点（OpenAI、DeepSeek、vLLM、SGLang 等）

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/YUI.git
cd YUI
```

### 2. 后端设置

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 API 密钥和端点

# 启动后端服务
python main.py
```

后端服务运行在 `http://localhost:8001`

### 3. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务运行在 `http://localhost:5173`

### 4. 配置模型源

1. 在浏览器中打开 `http://localhost:5173`
2. 点击右上角 **设置** 图标
3. 点击 **模型来源配置**
4. 添加你的模型源：
   - **项目名称**：自定义名称（如 "本地 vLLM"）
   - **Base URL**：`http://127.0.0.1:8000/v1`
   - **API Key**：你的 API 密钥
5. 点击 **检测** 按钮，自动发现可用模型
6. 为每个模型配置类型和是否为推理模型

## 📖 使用指南

### 配置推理模型

**示例：配置 Qwen3-30B-Thinking**

1. 在模型源配置中添加本地 vLLM：
   - Base URL: `http://127.0.0.1:8000/v1`
   - API Key: `dummy`
2. 点击 **检测**，找到 `qwen3-30b-thinking`
3. 勾选该模型的 **是否是推理模型** 复选框
4. 保存配置

现在使用该模型时，推理过程会自动折叠显示！

### 禁用推理过程（可选）

如果你想禁用某些推理模型的思考过程：

1. 打开 **设置** → **额外参数**
2. 点击 **添加参数**
3. 配置：
   - 参数名：`extra_body`
   - 参数类型：`JSON`
   - 参数值：`{"chat_template_kwargs": {"enable_thinking": false}}`
4. 确保复选框已勾选

### 添加高级参数

**示例：配置 Top-K 采样和重复惩罚**

1. 打开 **设置** → **额外参数**
2. 添加参数 1：
   - 参数名：`top_k`
   - 参数类型：`数字`
   - 参数值：`40`
3. 添加参数 2：
   - 参数名：`repeat_penalty`
   - 参数类型：`数字`
   - 参数值：`1.1`

### 导出对话记录

**单个对话**：
- 点击对话标题旁的 **导出** 按钮
- 选择保存位置

**所有对话**：
- 打开 **设置** → 滚动到底部
- 点击 **导出所有对话**

## 🔧 配置说明

### 后端配置 (`.env`)

```bash
# API 配置
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=http://127.0.0.1:8000/v1  # 或其他兼容端点

# 服务器配置
HOST=0.0.0.0
PORT=8001
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 使用 vLLM（本地推理）

```bash
# 启动 vLLM 服务器
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8000

# 在前端配置模型源
# Base URL: http://127.0.0.1:8000/v1
# API Key: dummy
```

### 使用 DeepSeek API

```bash
# 在前端配置模型源
# Base URL: https://api.deepseek.com
# API Key: 你的 DeepSeek API Key
```

## 📁 项目结构

```
YUI/
├── backend/                    # FastAPI 后端
│   ├── main.py                # 主服务器应用
│   ├── requirements.txt       # Python 依赖
│   └── .env                   # 环境配置
│
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── Message.tsx          # 消息显示（含推理过程）
│   │   │   ├── ChatInput.tsx        # 输入框
│   │   │   ├── Sidebar.tsx          # 侧边栏
│   │   │   ├── ChatPanel.tsx        # 对话面板
│   │   │   ├── SettingsPanel.tsx    # 设置面板
│   │   │   └── ModelSourcesPanel.tsx  # 模型源配置
│   │   ├── store/             # Zustand 状态管理
│   │   │   └── index.ts       # 全局状态
│   │   ├── services/          # API 服务
│   │   │   └── api.ts         # Chat API 客户端
│   │   ├── types/             # TypeScript 类型
│   │   │   └── index.ts       # 类型定义
│   │   └── utils/             # 工具函数
│   ├── package.json
│   └── vite.config.ts
│
├── CLAUDE.md                   # Claude Code 指导文档
├── README.md                   # 本文档
└── .gitignore
```

## 🔌 API 端点

### 后端 API

```
GET  /health                    # 健康检查
POST /v1/chat                   # 非流式聊天
POST /v1/chat/stream            # 流式聊天 (SSE)
GET  /v1/models                 # 列出可用模型
```

## 🛠️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **状态管理**：Zustand + persist middleware
- **Markdown**：react-markdown + remark-gfm
- **代码高亮**：react-syntax-highlighter (Prism)
- **图标**：lucide-react

### 后端
- **框架**：FastAPI
- **HTTP 客户端**：httpx (异步)
- **CORS**：fastapi.middleware.cors
- **数据验证**：Pydantic

## 🚧 故障排除

### 后端无法启动
- 检查 Python 版本：`python --version`（应为 3.11+）
- 确认 8001 端口未被占用：`lsof -i:8001`
- 检查 `.env` 文件配置

### 前端无法连接后端
- 确认后端服务正在运行
- 检查浏览器控制台是否有 CORS 错误
- 验证 `vite.config.ts` 中的代理配置

### 推理过程不显示
- 确认模型已标记为"推理模型"
- 检查浏览器控制台日志：
  - `Model xxx is reasoning model: true`
  - `Found </think> tag at index: xxx`
- 确认模型返回了 `reasoning_content` 或 `<think>` 标签

### 额外参数不生效
- 确认参数的启用复选框已勾选
- 检查浏览器控制台的请求体日志
- 对于 `extra_body`，确认参数类型为 `JSON`
- 验证 JSON 格式正确（使用在线 JSON 验证器）

## 📦 生产部署

### 构建前端

```bash
cd frontend
npm run build
# 输出到 frontend/dist/
```

使用 Nginx、Apache 或任何静态文件服务器托管 `dist/` 目录。

### 运行后端

```bash
cd backend
pip install -r requirements.txt

# 使用 uvicorn 生产模式
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 灵感来源于 [OpenWebUI](https://github.com/open-webui/open-webui)
- 使用 [React](https://react.dev/)、[FastAPI](https://fastapi.tiangolo.com/) 和 [Vite](https://vitejs.dev/) 构建
- UI 组件使用 [Tailwind CSS](https://tailwindcss.com/) 样式化
- 由 [Claude](https://claude.ai/) 辅助开发

## 📮 支持

遇到问题？

- 查看 [CLAUDE.md](./CLAUDE.md) 获取开发指导
- 在 GitHub 上提交 Issue
- 查看上方的故障排除部分

---

<div align="center">

**开始愉快的对话吧！🤖💬**

Made with ❤️ by YUI Team

</div>
