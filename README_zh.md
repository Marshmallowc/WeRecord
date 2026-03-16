# WeRecord - 情侣财务管理生态系统

WeRecord 是一款专为情侣设计的顶级财务管理生态系统，旨在通过技术手段弥合共同生活中的信息不对称。它不仅能进行高精度的支出记录，还能通过 AI 驱动的见解和礼物记录功能，将日常的账目转化为具有纪念意义的关系里程碑。

[English](README.md) | 简体中文

## 核心价值主张

- **透明与和谐**：通过实时共享账本，彻底消除“谁花了多少”的摩擦。
- **礼物收藏夹**：专门的空间记录每一份心意，确保双方的付出都被铭记。
- **AI 智能洞察**：接入 DeepSeek，解析自然语言输入并生成深度的财务行为分析。
- **快速结算**：针对现代移动端优化的 AA 账单批量结算体验，一键理清多笔债务。

## 技术架构与工程卓越性

本项目基于最前沿的 Web 技术栈构建，优先保证状态的确定性、无偏移的页面导航以及高度的后端数据安全性。

### 现代化技术栈
- **框架**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- **库**: [React 19](https://react.dev/) (Concurrent Mode, Actions)
- **语言**: TypeScript 5.x (严格类型安全)
- **后端**: [Supabase](https://supabase.com/) (PostgreSQL + RLS, Storage, Realtime)
- **AI**: DeepSeek API (自然语言处理与结构化分析)
- **样式**: 基于严格**设计令牌 (Design Token)** 系统的 Vanilla CSS，追求极致性能。

### 工程亮点

#### 1. 零延迟水合 (SWR 深度集成)
WeRecord 采用激进的 `SWR` (Stale-While-Revalidate) 缓存策略。通过先展示本地缓存数据，同时在后台静默更新，实现类原生应用的流畅感受，彻底告别 UI 阻塞。

#### 2. AI 洞察引擎
不仅仅是数据提取。系统通过分析消费模式，提供 **AI 洞察 (AI Insights)**，帮助情侣理解财务轨迹，共同庆祝每一个理财里程碑。

#### 3. 动态时刻 (Moments)
专属的 **Moments 动态流**支持为记录附加图片凭据或生活记忆。通过 `browser-image-compression` 进行客户端高效压缩，安全存储于 Supabase。

#### 4. 高保真设计系统
我们拒绝过度膨胀的工具库，采用全手写的 **Vanilla CSS 架构**。集成了玻璃拟态 (Glassmorphism)、硬件加速动画和移动端优先的自适应布局。灵动的 SVG 角色为极简界面注入了“人情味”。

#### 5. 原生 PWA 与 Web 推送
完全遵循 PWA 标准，自主实现 Service Worker。通过 Web Push API 提供即时通知，即使应用未处于前台，也能确保情侣间的财务动态实时同步。

## 安装与开发环境部署

### 前置条件
- Node.js 20.x 或更高版本
- 可用的 Supabase 项目 (表结构见 `supabase_schema.sql`)
- DeepSeek API 访问权限

### 初始化流程

1. **克隆与安装**
   ```bash
   git clone git@github.com:Marshmallowc/WeRecord.git
   cd WeRecord
   npm install
   ```

2. **环境变量配置**
   创建 `.env.local` 文件：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **数据库初始化**
   在 Supabase SQL 执行器中依次运行 `supabase_schema.sql` 和 `ai_insights_schema.sql`，配置表结构、RLS 策略和存储桶。

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

## 代码拓扑结构

- `/src/app`: 路由定义、API 处理器及全局布局。
- `/src/components`: 原子化 UI 组件与交互模块。
- `/src/context`: 全局状态编排 (身份验证、通知)。
- `/src/lib`: 核心逻辑抽象、Supabase 客户端及 AI 集成工具。
- `/public`: 静态资源、PWA 配置及 Service Worker 入口。

## 生产环境部署

针对 **Vercel** 进行了深度优化。部署前请确保生产环境已注入 Supabase 节点、AI 密钥等环境变量，以保障 Edge/Serverless 函数的正常运行。
级加速。

#### 5. AI 赋能的实体识别与映射
后端服务基于 Vercel Edge 环境建立对 DeepSeek API 的安全请求通道。引擎能够对用户输入的非结构化自然语言（例如：“今天我付了50元晚饭钱”）进行解析，并转化为高度结构化的数据库映射关系（金额、类别、支付方、分担逻辑），从根本上避免了传统管理应用中繁冗的表单交互。

#### 6. 数据库级别的数据完备性控制
本应用的底层数据支持由 Supabase 的 PostgreSQL 服务提供。所有接口交互的权限边界均采用行级安全 (RLS) 策略进行密码学的强制阻断。用户基础数据、公共账单 (`aa_bills`)、多分类项目汇总 (`aa_items`) 以及独立礼物流水 (`gifts`) 之间的关系完整性要求在数据库层面进行物理级保障。

## 安装与本地环境部署

### 前置条件
- Node.js 18.0 或更高版本
- 可用的 Supabase 项目配置
- 获取 DeepSeek API 的有效鉴权凭证

### 初始化流程

1. **克隆代码库**
   ```bash
   git clone git@github.com:Marshmallowc/WeRecord.git
   cd WeRecord
   ```

2. **环境变量配置**
   需在根目录创建 `.env.local` 配置文件，并同步相应的环境签名信息：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **数据库模型迁移**
   请于 Supabase 原生 SQL 执行器中运行根目录提供的 `supabase_schema.sql`，进行数据表的实例化、存储桶的授权并应用底层 RLS 控制。

4. **安装本地依赖**
   ```bash
   npm install
   ```

5. **执行编译/运行**
   ```bash
   npm run dev
   ```

## 代码目录拓扑

- `/src/app`: 定义路由层级解析及服务端 API 网关代理。
- `/src/components`: 细粒度且具备独立渲染生命周期的 React 纯UI组件库。
- `/src/context`: 定义全局级别的状态上下文环境 (IdentityContext, NotificationContext 等)。
- `/src/lib`: 应用核心抽象层，涵盖业务逻辑校验、Supabase 客户端单例实例等。
- `/public`: 映射静态路由路径存储静态资源、清单声明以及 Service Worker 入口。

## 生产环境部署规范

该库的代码结构对于 Serverless 环境 (如 Vercel) 进行了重度适配。部署至生产节点前，应前置校验 CI/CD 流程中对于 Supabase 节点端点、AI 握手密钥等环境变量参数的注入完整度。
