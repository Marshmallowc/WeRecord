# WeRecord

WeRecord is a premium financial management ecosystem meticulously engineered for couples to bridge the transparency gap in shared living. It transforms mundane transaction tracking into meaningful relationship milestones through high-precision expense logging, gift archiving, and AI-driven behavioral insights.

English | [简体中文](README_zh.md)

## Core Value Proposition

- **Transparency & Harmony**: Eliminate "who spent what" friction with real-time shared ledgers.
- **Gift Archiving**: Never lose track of thoughtful moments; a dedicated space for personal gifts and mutual appreciation.
- **AI-Driven Clarity**: Leverages DeepSeek to parse natural language and generate deeply personal financial insights.
- **Micro-Settle**: Batch settlement for AA bills with a single-click experience, designed for modern mobile workflows.

## Technical Architecture & Engineering Excellence

The system is built on a state-of-the-art web stack, prioritizing deterministic state, zero-layout-shift navigation, and robust backend integrity.

### Modern Stack
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- **Library**: [React 19](https://react.dev/) (Concurrent Mode, Actions)
- **Language**: TypeScript 5.x (Strict Type Safety)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS, Storage, Realtime)
- **AI**: DeepSeek API (Natural Language Processing & Analytical Insights)
- **UI**: Vanilla CSS with a strict **Design Token System** for performance and precision.

### Engineering Highlights

#### 1. Zero-Latency Hydration (SWR Integration)
WeRecord utilizes an aggressive `SWR` (Stale-While-Revalidate) strategy. By serving stale data from local cache while fetching updates in the background, the application achieves a "native-app" feel with immediate response times and zero blocking UI waterfalls.

#### 2. AI Intelligence Layer
The integration with DeepSeek goes beyond simple parsing. The system analyzes spending patterns to offer **AI Insights**, helping couples understand their financial trajectory and celebrate saving milestones together.

#### 3. Moments & Media
A dedicated **Moments Feed** allows users to attach image evidence or memories to specific records. High-efficiency image compression is performed client-side via `browser-image-compression` before being securely stored in Supabase Storage.

#### 4. High-Fidelity Design System
Rejecting utility-first bloat, we implement a custom **Vanilla CSS architecture**. It employs glassmorphism, hardware-accelerated animations, and responsive layouts tailored for a mobile-first experience. Playful SVG characters add a "human touch" to the minimalist interface.

#### 5. Native PWA & Web Push
Fully compliant with PWA standards, WeRecord includes a custom Service Worker for offline capabilities and leverages the Web Push API for real-time notifications, ensuring couples stay synchronized even when the app is closed.

## Installation & Setup

### Prerequisites
- Node.js 20.x or higher
- A Supabase Project (Schema provided in `supabase_schema.sql`)
- DeepSeek API Access

### Setup Sequence

1. **Clone & Install**
   ```bash
   git clone git@github.com:Marshmallowc/WeRecord.git
   cd WeRecord
   npm install
   ```

2. **Environment Configuration**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **Database Setup**
   Run `supabase_schema.sql` and `ai_insights_schema.sql` in your Supabase SQL editor to initialize tables, RLS policies, and storage buckets.

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## Repository Topology

- `/src/app`: Routes, API Handlers, and Global Layouts.
- `/src/components`: Atomic UI components and interactive modules.
- `/src/context`: Global state orchestration (Auth, Notifications).
- `/src/lib`: Core logic, Supabase clients, and AI integration utilities.
- `/public`: Static assets, PWA manifest, and Service Worker.

## Deployment

Optimized for **Vercel**. Ensure all environment variables are mirrored in your Vercel project settings for seamless deployment of Edge and Serverless functions.

