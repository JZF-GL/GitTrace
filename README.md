# GitTrace 🚀

> 现代化、轻量级、跨平台的 Git 可视化桌面客户端。基于 **Electron + Vue 3 + TypeScript + Vite + Naive UI** 构建。

---

## 📖 项目简介

**GitTrace** 是一款专为开发者打造的现代化 Git 桌面客户端工具。它旨在通过直观友好的图形界面，帮助开发者高效管理多个 Git 仓库、可视化浏览分支与提交历史图谱、轻松完成代码暂存与差异对比、处理分支合并与冲突、以及执行常用和自定义 Git 指令。

---

## ✨ 核心特性

### 1. 🌳 提交历史与分支图谱 (Commit History & Graph)
- **多分支图谱渲染**：清晰展示分支分叉、汇合演变路径与拓扑图谱，彩色节点区分分支上下文。
- **提交详情查看**：支持查看单次提交的作者、时间、哈希、父节点、修改文件列表及行增删统计。
- **提交搜索与筛选**：支持按分支过滤，以及按 Commit Message、作者、Hash 快速搜索历史。
- **快捷版本操作**：支持基于指定提交创建分支、检出 (Checkout)、Cherry-pick、撤销与回滚 (Soft / Mixed / Hard Reset)。

### 2. 📝 工作区与暂存区管理 (Staging Area & Diff Viewer)
- **工作区分组管理**：实时感知文件状态变更，清晰归类暂存区（Staged）、未暂存（Unstaged）、未跟踪（Untracked）和冲突文件（Conflicted）。
- **精细化暂存操作**：支持单文件暂存/取消暂存/丢弃改动，支持一键全部暂存或撤销。
- **内置 Diff 差异对比器**：色彩分明地逐行展示代码变动差异（Additions / Deletions）。
- **规范化提交面板**：支持配置全局与项目级提交前缀模板（如 `feat:`, `fix:`, `refactor:`, `chore:` 等），一键插入规范 Message。

### 3. 🌿 分支、标签与远程管理 (Branches, Tags & Remotes)
- **分支概览与追踪**：展示本地分支与远程分支，实时显示 Ahead / Behind（领先/落后）提交计数。
- **分支生命周期**：快速创建本地分支、安全/强制删除本地分支、删除远程分支、合并分支（Merge）与变基（Rebase）。
- **标签管理 (Tags)**：支持查看标签列表、在指定提交上创建 Tag 与删除 Tag。
- **远程协作 (Remotes)**：支持多 Remote 管理，一键 Fetch、Pull、Push、Publish 分支，支持后台静默刷新远程状态。

### 4. 📦 Stash 贮藏区 (Stash Management)
- **改动贮藏**：支持一键将当前未提交改动暂存到 Stash，支持自定义备注说明或指定暂存文件。
- **列表与预览**：随时浏览所有 Stash 记录，支持预览 Stash 内容及差异对比。
- **恢复与清理**：支持弹出应用（Pop）或丢弃（Drop）指定的 Stash。

### 5. ⚔️ 冲突解决 (Conflict Resolver)
- **冲突状态识别**：合并或变基过程中发生冲突时自动检测，提示冲突文件列表。
- **差异对比解决**：可视化展示冲突代码块，辅助开发者快速解决冲突并标记状态。

### 6. 💻 内置交互终端与快捷指令 (Terminal & Quick Commands)
- **内置 Git 终端**：提供无缝命令行执行窗口，支持直接运行原生 Git 指令。
- **快捷指令模板**：支持在设置中自定义全局与独立项目的常用 Git 命令集合，点击即可执行，大幅减少重复输入。

### 7. 📜 命令执行日志与审计 (Git Log Audit)
- **全量命令追踪**：详细记录每一次由 UI 触发的底层 Git 命令、执行耗时、成功/失败状态与输出日志，便于排查与审计。

### 8. 🎨 现代化暗黑 UI 与多仓库管理
- **暗黑主题设计**：全界面深度适配暗黑美学主题，视觉体验舒适。
- **多仓库工作流**：左侧栏集中式管理多仓库，支持快速添加、拖拽排序、快速切换。
- **自定义无边框窗口**：提供原生样式的自定义标题栏与流畅的窗口控制（最小化/最大化/关闭）。

---

## 🛠️ 技术栈与架构设计

### 前端技术栈 (Renderer Process)
| 技术 | 说明 |
| :--- | :--- |
| **Vue 3** | 采用 Composition API (`<script setup>`)，响应式与组件化架构 |
| **TypeScript** | 全流程静态类型检查与严谨的接口定义 |
| **Vite 5** | 极速现代前端构建工具与开发服务器 |
| **Naive UI** | 精致、高效的 Vue 3 组件库 |
| **Pinia** | 模块化状态管理（Repository, Commits, Staging, Branches, Terminal, Settings 等） |
| **@vueuse/core** | 常用 Composition 组合式工具集 |

### 桌面端与后端服务 (Main Process & Electron)
| 技术 | 说明 |
| :--- | :--- |
| **Electron 30** | 跨平台桌面应用开发框架 |
| **simple-git** | 稳定且功能全面的 Git 底层命令封装与交互引擎 |
| **IPC 模块化设计** | 拆分为 `git-handlers`、`repo-handlers`、`settings-handlers`、`dialog-handlers` 等独立通道 |
| **服务层分层 (Services)** | `git-service`（Git 核心交互）、`repo-manager`（仓库持久化）、`settings`（配置管理）、`git-log`（操作日志） |

---

## 📁 目录结构

```text
GitTrace/
├── electron/                   # Electron 主进程源码
│   ├── ipc/                    # IPC 进程间通信通道与事件处理器
│   │   ├── dialog-handlers.ts  # 原生弹窗/选择文件夹处理
│   │   ├── git-handlers.ts     # Git 各种操作的 IPC 路由
│   │   ├── repo-handlers.ts    # 仓库列表增删查改 IPC 路由
│   │   └── settings-handlers.ts# 配置读取与保存 IPC 路由
│   ├── services/               # 核心业务服务层
│   │   ├── git-log.ts          # Git 执行日志收集服务
│   │   ├── git-service.ts      # simple-git 底层封装与命令执行
│   │   ├── repo-manager.ts     # 本地仓库持久化存储管理
│   │   └── settings.ts         # 用户自定义设置持久化服务
│   ├── main.ts                 # Electron 启动入口与主窗口生命周期管理
│   └── preload.ts              # Preload 预加载脚本，安全注入 contextBridge API
│
├── src/                        # 前端渲染进程源码 (Vue 3)
│   ├── components/             # 功能组件库
│   │   ├── commits/            # 提交历史、图谱绘制、提交详情组件
│   │   ├── conflict/           # 代码冲突检测与解决组件
│   │   ├── git-log/            # 底层 Git 执行日志浮层组件
│   │   ├── layout/             # 侧边栏 (Sidebar)、标题栏 (TitleBar)、空状态等布局
│   │   ├── remote/             # 远程仓库与分支管理面板
│   │   ├── repository/         # 仓库主视图 (RepoView)
│   │   ├── settings/           # 自定义配置弹窗组件
│   │   ├── staging/            # 工作区与暂存区、文件列表、Diff 查看器
│   │   ├── stash/              # Stash 贮藏区管理面板
│   │   └── terminal/           # 内置终端与快捷指令面板
│   ├── stores/                 # Pinia 状态管理模块
│   │   ├── app.ts              # 应用全局状态 (Tab、侧边栏折叠等)
│   │   ├── branches.ts         # 分支与超前/落后状态
│   │   ├── commits.ts          # 提交历史与图谱数据
│   │   ├── repository.ts       # 仓库列表与当前选中仓库
│   │   ├── settings.ts         # 用户偏好设置
│   │   ├── staging.ts          # 暂存区与工作区文件状态
│   │   ├── tags.ts             # 标签数据
│   │   └── terminal.ts         # 终端输出与执行状态
│   ├── styles/                 # 全局样式与暗黑主题定义 (dark-theme.css)
│   ├── types/                  # TypeScript 类型声明 (electron.d.ts 等)
│   ├── views/                  # 主视图页面 (MainView.vue)
│   ├── App.vue                 # 根组件
│   └── main.ts                 # 渲染进程入口，加载 Pinia 与样式
│
├── build/                      # 应用打包图标与安装包资源
├── package.json                # 项目依赖与构建脚本配置
├── tsconfig.json               # TypeScript 配置
└── vite.config.ts              # Vite & vite-plugin-electron 配置文件
```

---

## 🚀 快速上手与开发

### 前置环境要求
- **Node.js**: `>= 18.0.0`
- **包管理器**: `pnpm` (推荐) 或 `npm`
- **Git**: 系统已安装 Git 并配置到环境变量中

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动开发模式 (热重载)
启动 Vite 开发服务器及 Electron 桌面应用窗口：
```bash
pnpm run electron:dev
# 或者
pnpm run dev
```

### 3. 构建打包 (生成安装包)
使用 `electron-builder` 生成 Windows 安装包（NSIS 可执行程序）及静态产物：
```bash
pnpm run build
```
打包输出目录位于 `release/` 文件夹下。

---

## 📄 许可证 (License)

本项目遵循开源规范进行开发与分发。
