# WeRecord - 情侣财务管理系统

WeRecord 是一款专为情侣设计的精细化财务管理应用程序，旨在追踪共享支出、个人礼物以及双方的债务轨迹。系统集成了高级分析看板与 AI 驱动的洞察功能，将原始交易数据转化为具有意义的关系里程碑。

[English](README.md) | 简体中文

## 技术架构

### 核心技术栈
- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript
- **数据库**: Supabase (PostgreSQL)
- **样式**: 基于设计令牌系统的 Vanilla CSS
- **图标**: Lucide React
- **数据获取**: SWR (Stale-While-Revalidate)
- **AI 集成**: DeepSeek API（用于自然语言交易解析与情感洞察）

### 核心功能
- **自然语言录入**: 通过 AI 解析引擎高效记录交易。
- **动态分析看板**: 可视化消费趋势与债务轨迹，支持自定义时间范围（7天、30天、90天、全部）。
- **身份管理**: 原生支持双用户视角切换。
- **分析洞察**: 自动生成财务健康报告与支出密度指标。
- **响应式界面**: 针对高密度信息显示优化的移动优先架构。

## 安装与部署

### 前置条件
- Node.js 18.0 或更高版本
- Supabase 项目
- DeepSeek API 访问权限

### 本地设置

1. **克隆仓库**
   ```bash
   git clone git@github.com:Marshmallowc/WeRecord.git
   cd WeRecord
   ```

2. **环境变量配置**
   在根目录下创建 `.env.local` 文件：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **数据库迁移**
   在 Supabase SQL 编辑器中执行提供的 `supabase_schema.sql`，以初始化必要的表和行级安全 (RLS) 策略。

4. **安装依赖**
   ```bash
   npm install
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
   ```

## 项目结构

- `/src/app`: 应用程序路由与 API 接口。
- `/src/components`: 可复用的 UI 组件与视觉资产。
- `/src/context`: 全局状态管理与身份提供者。
- `/src/lib`: 逻辑工具函数与 Supabase 客户端配置。

## 部署

本项目针对 Vercel 进行了优化。部署前请确保在 Vercel 控制台中正确配置所有环境变量。
