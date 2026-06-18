# GreenGuard: AI Civic Agent

> **An AI civic agent that ensures no complaint is ignored.**
> Most systems just report problems. Ours decides when to escalate—and writes the message.

## The Civic Trust Gap
Municipal waste management often suffers from a broken feedback loop. Citizens report issues, but receive no updates. Administrators drown in duplicate complaints and lack prioritization. The result? Unresolved waste hazards and eroded civic trust.

## The GreenGuard Solution
GreenGuard is a real-time, AI-driven civic agent that triages incoming waste reports, detects duplicates via perceptual hashing, auto-dispatches collectors based on proximity and workload, and proactively escalates worsening trends to municipal officers. The loop is closed with an automated SMS rewards system that incentivizes community participation.

## Key Features
- **Intelligent Triage:** Multi-modal AI (Gemini 2.5) instantly categorizes waste, assesses severity, and sets priority using uploaded images and text.
- **Agentic Escalation:** Autonomous cron agents monitor weekly trends and automatically draft escalation memos to officials if critical issues persist.
- **Smart-Bin Integration:** Real-time Socket.io alerts trigger on-the-fly AI warnings when physical bins reach 95% capacity.
- **Algorithmic Dispatch:** Collectors are automatically assigned based on city, ward, and current active workload to ensure rapid resolution.
- **Behavioral Economics:** Citizens earn points and unlock badges for valid reports and recycling, redeemable at local Coonoor stores.

## System Architecture
* **Frontend:** React + Vite, Tailwind CSS, Recharts (Data Viz)
* **Backend:** Node.js, Express, Prisma ORM (SQLite)
* **AI Layer:** Google Gemini (Multi-modal Vision & Text)
* **Real-time:** Socket.io
* **Cloud Infrastructure:** Cloudinary (Image storage)

## Demo Flow
1. **Citizen Report:** Submit a complaint with a photo. The AI categorizes it in < 3 seconds.
2. **Admin Insight:** The admin dashboard updates instantly with live charts and real-time smart-bin alerts.
3. **Auto-Dispatch:** The system automatically routes the complaint to the most available collector.
4. **Agent Action:** View the AI Confidence Panel and see an automatically generated escalation draft for worsening trends.
5. **Resolution:** The collector resolves the issue. The citizen receives an AI-crafted SMS and earns reward points.

## Project Structure
```
/frontend    - React application, UI components, context providers, and pages
/backend     - Node.js API, Socket.io server, Gemini services, and Prisma schema
  /scripts   - Utilities and data-seeding tools
  /tests     - E2E and functional test suites
```

## Setup Instructions
1. Navigate to `/backend` and run `npm install`. Set up your `.env` with Gemini, Twilio, and Cloudinary keys.
2. Run `npx prisma db push` followed by `node scripts/seed.js`.
3. Start the backend: `npm run dev`
4. Navigate to `/frontend` and run `npm install`.
5. Start the frontend: `npm run dev`
