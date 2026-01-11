# YUI ChatBox 离线安装部署指南

## 📋 系统要求

- **Python**: 3.8 或更高版本
- **操作系统**: Linux、macOS 或 Windows
- **磁盘空间**: 至少 50MB
- **网络**: 无需互联网连接（完全离线安装）

---

## 📦 安装包说明

**文件名**: `yui-chatbox-offline-1.0.0.tar.gz`  
**大小**: 约 14MB

包含内容：
- YUI ChatBox 主程序
- 所有 Python 依赖（28个包）
- 前端静态文件（已预构建）
- 自动安装脚本
- 使用文档

---

## 🚀 快速安装

### Linux / macOS

```bash
# 1. 解压安装包
tar -xzf yui-chatbox-offline-1.0.0.tar.gz
cd yui-chatbox-offline-1.0.0

# 2. 运行安装脚本
./install.sh

# 安装过程会自动完成，等待提示"Installation complete!"
```

### Windows

```cmd
1. 右键解压 yui-chatbox-offline-1.0.0.tar.gz
2. 进入解压后的文件夹
3. 双击运行 install.bat
4. 等待安装完成
```

---

## ⚙️ 配置

### 1. 初始化配置文件

安装完成后，运行：

```bash
# Linux/macOS
python3 -m yuichatbox init-config

# Windows
python -m yuichatbox init-config
```

这会在当前目录创建 `.env` 配置文件。

### 2. 编辑配置文件

打开 `.env` 文件，填入你的 API 信息：

```env
# OpenAI API 配置（或其他兼容的 API）
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-api-key-here

# 可选：默认模型
DEFAULT_MODEL=gpt-4
```

**常用 API 配置示例**：

```env
# OpenAI
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...

# DeepSeek
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_KEY=sk-...

# 其他 OpenAI 兼容 API
OPENAI_BASE_URL=https://your-api-endpoint/v1
OPENAI_API_KEY=your-key
```

---

## 🎯 启动服务

### 启动命令

```bash
# Linux/macOS
python3 -m yuichatbox serve

# Windows
python -m yuichatbox serve
```

### 访问应用

启动成功后，打开浏览器访问：

```
http://localhost:8001
```

你会看到类似输出：
```
======================================================================
YUI ChatBox - Production Mode
======================================================================
Server URL: http://0.0.0.0:8001
Press Ctrl+C to stop
======================================================================
```

---

## 📚 使用说明

### 首次使用

1. **添加模型源**
   - 点击右上角设置按钮
   - 选择"模型源管理"
   - 添加你的 API 配置

2. **开始对话**
   - 点击"新建对话"
   - 选择模型
   - 开始聊天

### 主要功能

- ✅ 多模型支持（OpenAI、DeepSeek、Claude等）
- ✅ 对话管理（文件夹分类、搜索、置顶）
- ✅ 消息导出/导入
- ✅ 深色/浅色主题
- ✅ Markdown 和代码高亮
- ✅ 推理过程可视化（思维链模型）

---

## 🛠️ 常见问题

### 1. 找不到 Python 命令

**问题**: `python3: command not found`

**解决**:
```bash
# 检查 Python 是否安装
python --version
# 或
python3 --version

# 如果未安装，需要先安装 Python 3.8+
```

### 2. pip 安装失败

**问题**: `pip install` 失败或找不到 pydantic-core

**解决**:
```bash
# 确保使用离线安装
python3 -m pip install --no-index --find-links=wheels yuichatbox-*.whl

# 如果仍然失败，检查wheels目录
ls -la wheels/ | grep pydantic


**注意**: 最新版安装包（v1.0.0）已包含所有必需依赖，包括 pydantic-core。如果使用旧版安装包，请下载最新版本。

### 3. 无法访问 8001 端口

**问题**: 浏览器无法访问

**解决**:
- 检查防火墙设置
- 确保端口 8001 未被占用
- 尝试访问 `http://127.0.0.1:8001`

### 4. API 连接失败

**问题**: "Connection error" 或 "API key invalid"

**解决**:
- 检查 `.env` 文件中的 API 配置
- 确认 API Key 正确
- 检查 OPENAI_BASE_URL 格式（需要包含 `/v1`）

### 5. 数据存储位置

**问题**: 数据保存在哪里？

**回答**:
- 数据库文件: `~/.yui/chatbox.db`
- 配置文件: 当前目录的 `.env`
- 所有对话和设置都保存在本地数据库

---

## 🔧 高级配置

### 自定义端口

```bash
# 修改端口为 8080
export PORT=8080
python3 -m yuichatbox serve
```

### 后台运行

```bash
# Linux/macOS - 使用 nohup
nohup python3 -m yuichatbox serve > yui.log 2>&1 &

# 查看日志
tail -f yui.log

# 停止服务
pkill -f "yuichatbox serve"
```

### 开机自启动 (Linux systemd)

创建服务文件 `/etc/systemd/system/yui-chatbox.service`:

```ini
[Unit]
Description=YUI ChatBox Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/directory
Environment="PATH=/usr/bin"
ExecStart=/usr/bin/python3 -m yuichatbox serve
Restart=always

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl enable yui-chatbox
sudo systemctl start yui-chatbox
sudo systemctl status yui-chatbox
```

---

## 📊 数据备份

### 备份数据库

```bash
# 备份数据库文件
cp ~/.yui/chatbox.db ~/.yui/chatbox.db.backup

# 或使用日期标记
cp ~/.yui/chatbox.db ~/.yui/chatbox.db.$(date +%Y%m%d)
```

### 恢复数据

```bash
# 停止服务
pkill -f "yuichatbox serve"

# 恢复数据库
cp ~/.yui/chatbox.db.backup ~/.yui/chatbox.db

# 重新启动服务
python3 -m yuichatbox serve
```

---

## 🔄 更新升级

当有新版本时：

1. 停止当前服务
2. 备份数据库
3. 安装新的离线安装包
4. 重新启动服务

数据库会自动迁移到新版本。

---

## 📞 获取帮助

### 查看帮助信息

```bash
python3 -m yuichatbox --help
```

### 检查版本

```bash
python3 -m yuichatbox --version
```

### 支持

如遇问题，请提供：
- Python 版本
- 操作系统
- 错误日志
- 配置文件（隐藏 API Key）

---

## ✅ 安装验证清单

安装完成后，请确认：

- [ ] Python 版本 >= 3.8
- [ ] 运行 `python3 -m yuichatbox --version` 成功
- [ ] `.env` 配置文件已创建
- [ ] API Key 已正确配置
- [ ] 服务可以启动（`python3 -m yuichatbox serve`）
- [ ] 浏览器可以访问 http://localhost:8001
- [ ] 可以创建对话并发送消息

全部完成即可正常使用！🎉
