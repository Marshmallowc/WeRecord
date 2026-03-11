# WeRecord

WeRecord is a sophisticated financial management application mathematically designed for couples to track shared expenses, personal gifts, and mutual debt trajectories with high precision. The system integrates advanced analytical dashboards and AI-driven insights to transform raw transactional data into meaningful relationship milestones.

English | [简体中文](README_zh.md)

## Technical Architecture & Core Advantages

The project is built on a modern, highly optimized web stack prioritizing instant loading, deterministic state management, and robust backend scalability.

### Core Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict Mode)
- **Database Backend**: Supabase (PostgreSQL, Storage, Realtime)
- **Styling**: Vanilla CSS engineered with a strict Design Token System
- **State & Data Fetching**: SWR (Stale-While-Revalidate)
- **AI Integration**: DeepSeek API for natural language entity extraction and structural analytics

### Engineering Highlights & Advantages

#### 1. Zero-Latency Navigation & Data Hydration
The application employs an aggressive caching strategy using `SWR` combined with Next.js Client Components. By stripping away heavy Server Component blocking on navigational pages, the application achieves instantaneous page transitions (Zero-Layout-Shift). Legacy cache data is served immediately while silently revalidating in the background, ensuring data freshness without sacrificing perceived performance.

#### 2. Progressive Web App (PWA) Capabilities
Architected natively as a PWA, WeRecord features a custom Service Worker implementation (`sw.js`) and manifest configuration. This allows the application to be installed across mobile operating systems with a native-like experience. Crucially, it integrates the Web Push API for real-time transactional alerts, maintaining persistent communication channels even when the application is closed.

#### 3. Intelligent State Persistence
User identity and session states are managed through a hybrid model utilizing HTTP-only cookies and `localStorage`. This ensures that Next.js Server Components possess identical identity context during initial renders as Client Components, preventing hydration mismatches and cascading UI reflows on load.

#### 4. Token-Driven Vanilla CSS
Deviating from utility-first frameworks, WeRecord adopts a heavily structured vanilla CSS architecture (`globals.css`). Utilizing CSS custom properties (variables) for theme tokens (colors, typography, spacing), it ensures mathematical precision in UI components like Glassmorphism variants and complex gradient borders. This drastically reduces the calculated CSS bundle size while maintaining fluid animations and transitions via hardware acceleration.

#### 5. AI-Powered Entity Extraction
The system interfaces directly with the DeepSeek API through secure Vercel edge/serverless functions. It parses unstructured, natural language input (e.g., "I paid $50 for dinner today") and deterministically maps it to strict database schemas (Amount, Category, Payer, Participant Split) bypassing conventional, form-heavy data entry requirements.

#### 6. Database Level Integrity
Powered by Supabase's underlying PostgreSQL engine, data access is secured cryptographically through Row Level Security (RLS) policies. Relational integrity between users, shared bills (`aa_bills`), categorized items (`aa_items`), and independent gifts (`gifts`) is enforced natively at the database level.

## Installation and Local Setup

### Prerequisites
- Node.js 18.0 or higher
- A configured Supabase Project
- Active DeepSeek API Access credentials

### Initialization Sequence

1. **Clone the Repository**
   ```bash
   git clone git@github.com:Marshmallowc/WeRecord.git
   cd WeRecord
   ```

2. **Environment Configuration**
   Provision a `.env.local` file in the root directory mirroring the required cryptographic keys and endpoints:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

3. **Database Migration**
   Execute the `supabase_schema.sql` script within the Supabase SQL Editor to initialize the relational schema, provision Storage buckets, and apply restrictive Row Level Security (RLS) policies.

4. **Dependency Installation**
   ```bash
   npm install
   ```

5. **Execution**
   ```bash
   npm run dev
   ```

## Repository Structure

- `/src/app`: Primary routing configuration, API endpoints, and layout structures (Next.js App Router).
- `/src/components`: Granular, reusable React UI interfaces.
- `/src/context`: React Context providers for global orchestration (IdentityContext, NotificationContext).
- `/src/lib`: Core logical utilities, cryptographic functions, and Supabase client singletons.
- `/public`: Static web assets, manifest definitions, and the Service Worker registration file.

## Deployment Specifications

The codebase is highly optimized for deployment environments supporting Serverless edge functions (e.g., Vercel). Pre-deployment checks must ensure that environment variables for Supabase REST endpoints and AI API endpoints are symmetrically configured in the production hosting dashboard.
