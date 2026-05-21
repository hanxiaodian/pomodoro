# 番茄钟

基于 Electron 的桌面番茄钟应用，采用暖色系浅色 UI。

![preview](https://img.shields.io/badge/platform-macOS-lightgrey) ![electron](https://img.shields.io/badge/electron-35.x-blue)

## 功能

- 标准番茄工作法时间节奏：专注 25 分钟 → 短休 5 分钟，每完成 4 个番茄切换长休 15 分钟
- 环形倒计时进度条，三种模式用不同强调色区分
- 底部 4 个圆点追踪当前大轮次进度
- 会话结束后推送系统原生通知
- 支持暂停 / 重置 / 跳过当前阶段
- 关闭窗口即退出进程，无后台残留
- 标题栏隐藏，窗口可拖拽

## 配色

| 元素 | 色值 |
|------|------|
| 背景 | `#F7F2EC` |
| 专注模式（环色 / 标签） | `#C65A4A` |
| 短休模式 | `#D9D2CC` |
| 长休模式 | `#6F655E` |
| 按钮 | `#EAE3DB` |
| 正文 | `#6F655E` |

## 文件结构

```
pomodoro/
├── main.js       # Electron 主进程：窗口创建、IPC 通知、生命周期
├── index.html    # 界面结构与样式
├── render.js     # 渲染进程逻辑：计时、状态管理、DOM 更新
└── package.json
```

## 快速开始

**环境要求**：Node.js 18+

```bash
npm install
npm start
```

## 工作原理

```
专注 25min → 短休 5min → 专注 25min → 短休 5min
→ 专注 25min → 短休 5min → 专注 25min → 长休 15min
→ 循环
```

`render.js` 中的核心状态机：

- `ticker`：`setInterval` 句柄，`null` 表示已停止
- `tick()`：每秒只写时间显示和环形偏移两个 DOM 节点
- `render()`：用户交互或模式切换时全量刷新所有 UI
- `sessionDone()`：会话结束时推进模式、更新计数、触发通知
