# WeRecord

WeRecord is a sophisticated financial management application designed for couples to track shared expenses, personal gifts, and mutual debt trajectory with high precision. The system integrates advanced analytical dashboards and AI-driven insights to transform raw transactional data into meaningful relationship milestones.

English | [简体中文](README_zh.md)

## Technical Architecture

### Core Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Vanilla CSS with Design Token System
- **Icons**: Lucide React
- **Data Fetching**: SWR (Stale-While-Revalidate)
- **AI Integration**: DeepSeek API for natural language transaction parsing and emotional insights

### Key Features
- **Natural Language Input**: Efficiently log transactions through an AI-powered parsing engine.
- **Dynamic Analytics Dashboard**: Visualise spending trends and balance trajectory across custom timeframes (7d, 30d, 90d, All).
- **Identity Management**: Native support for dual-user perspectives with persistent state.
- **Analytical Insights**: Automated generation of relationship financial health reports and spending density metrics.
- **Responsive Interface**: Mobile-first architecture optimized for high-density information display.

## Installation and Deployment

### Prerequisites
- Node.js 18.0 or higher
- Supabase Project
- DeepSeek API Access

### Local Setup

1.  **Clone the Repository**
    ```bash
    git clone git@github.com:Marshmallowc/WeRecord.git
    cd WeRecord
    ```

2.  **Environment Configuration**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    DEEPSEEK_API_KEY=your_deepseek_api_key
    ```

3.  **Database Migration**
    Execute the provided `supabase_schema.sql` within your Supabase SQL Editor to initialize the required tables and Row Level Security (RLS) policies.

4.  **Dependency Installation**
    ```bash
    npm install
    ```

5.  **Execution**
    ```bash
    npm run dev
    ```

## Project Structure

- `/src/app`: Application routing and API endpoints.
- `/src/components`: Reusable UI components and visual assets.
- `/src/context`: Global state management and identity providers.
- `/src/lib`: Logic utilities and Supabase client configuration.

## Deployment

This project is optimized for deployment on Vercel. Ensure all environment variables are correctly configured in the Vercel dashboard prior to deployment.
