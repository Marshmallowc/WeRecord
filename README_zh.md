# WeRecord - 情侣财务管理系统

WeRecord 是一款专为情侣设计的精细化财务管理应用程序，旨在精确追踪共享支出、个人礼物以及双方的债务轨迹。系统集成了高级分析看板与人工智能驱动的洞察功能，将核心交易数据转化为具有实际指导意义的关系里程碑。

[English](README.md) | 简体中文

## 技术架构与核心优势

本项目基于现代化的、针对性能高度优化的 Web 技术栈构建，优先保证页面的瞬时加载、确定性的状态管理以及后端的高可扩展性。

### 核心技术栈
- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript (严格模式)
- **数据库组件**: Supabase (PostgreSQL, 存储机制, 实时通信)
- **样式架构**: 基于严格的设计令牌 (Design Token) 系统的 Vanilla CSS
- **状态与请求缓存**: SWR (Stale-While-Revalidate)
- **AI 综合集成**: 接入 DeepSeek API 进行自然语言实体抽取及结构化分析

### 工程亮点与技术优势

#### 1. 零延迟导航与数据注入 (Waterfalls Elimination)
系统广泛采用了 `SWR` 结合 Next.js Client Components 的激进缓存策略。通过剥离导航页面中繁重的 Server Component 阻塞机制，应用实现了页面的瞬时切换（摒弃布局偏移）。客户端首先命中本地缓存渲染旧数据，并在后台静默发起网络请求以进行数据校验与更新，此机制兼顾了操作的流畅性与数据的实时一致性。

#### 2. 渐进式 Web 应用 (PWA) 深度集成
在架构层面原生支持 PWA 标准，自主实现了 Service Worker (`sw.js`) 与 Manifest 配置。这使得应用能在主流行移动操作系统内直接安装，提供类原生的应用体验。更重要的是，系统通过 Service Worker 集成了 Web Push API，保障了脱离浏览器前台环境下的实时账目变更通知推送。

#### 3. 智能且严谨的状态持久化
用户标识与会话状态由 HTTP-only Cookies 与 `localStorage` 进行混合驱动。该模型确保 Next.js 在服务端组件渲染初期即可获取与客户端组件完全对称的身份上下文结构，从而规避了水合 (Hydration) 阶段因数据不对等引发的页面重绘。

#### 4. 驱动于令牌体系的纯正 CSS
区别于传统 Utility-first 的类库框架，WeRecord 贯彻了一套具有严密逻辑层级的原生 CSS 架构 (`globals.css`)。采用 CSS 变量形式贯穿主题系统中的色彩、文字规范与间距控制，保证了微交互模块（如玻璃态遮罩及复杂渐变边框）在渲染时的数学级精确性，有效缩减了 CSS 产物体积并最大化利用硬件级加速。

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
