# My Phone Camera Sync

A secure, mobile-friendly web app that lets you use one phone as a camera and another as a live viewer. Built with Next.js, Supabase, and WebRTC.

## Features

- **Authentication** — Sign up, login, logout with Supabase Auth
- **Device management** — Add camera, viewer, or dual-purpose devices
- **Device pairing** — 6-digit codes and QR codes (expire after 10 minutes)
- **Live streaming** — WebRTC peer-to-peer video with Supabase Realtime signaling
- **Recording** — MediaRecorder API with upload to Supabase Storage
- **Security** — Camera/recording OFF by default, visible indicators, RLS on all tables

## Safety Design

| Rule | Implementation |
|------|----------------|
| No hidden camera | Camera starts only after clicking **Start Camera** |
| No secret recording | Recording OFF by default; red **REC** badge when active |
| User isolation | Row Level Security on every table |
| Clean shutdown | Tracks stopped when leaving the page |
| Signaling cleanup | Messages deleted when session ends |

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, Database, Realtime, Storage)
- WebRTC + MediaRecorder API
- Deploy-ready for Vercel

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish provisioning

### 2. Run the Database Schema

1. Open **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and run it

This creates all tables, RLS policies, storage bucket, and triggers.

### 3. Enable Realtime

1. Go to **Database → Replication** in Supabase
2. Confirm `signaling_messages` is enabled for Realtime
3. If not, run:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE signaling_messages;
   ```

### 4. Configure Auth

1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to `http://localhost:3000` (change for production)
3. Add redirect URL: `http://localhost:3000/auth/callback`

For email confirmation (optional):
- Go to **Authentication → Providers → Email**
- Disable "Confirm email" for easier local testing, or configure SMTP

### 5. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Find your Supabase URL and anon key under **Project Settings → API**.

### 6. Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Use

### First-time setup

1. **Sign up** for an account
2. **Add devices** on the dashboard (e.g. "My iPhone" as camera, "My iPad" as viewer)
3. **Pair devices** — on the camera phone, create a pairing code; on the viewer phone, enter it

### Stream live video

**Phone A (Camera):**
1. Dashboard → tap **Camera** on your camera device
2. Tap **Start Camera** (grant permission when prompted)
3. Tap **Start Streaming**
4. Wait for the viewer to connect

**Phone B (Viewer):**
1. Dashboard → tap **Viewer** on your viewer device
2. Select the paired camera
3. Tap **Connect to Stream**

### Record video

1. On the camera phone, with camera ON, tap **Start Recording**
2. A red **REC** indicator appears with a timer
3. Tap **Stop Recording** — the video uploads automatically
4. View recordings on the **Recordings** page

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/                # Login
│   ├── signup/               # Sign up
│   ├── dashboard/            # Device management
│   ├── pairing/              # Device pairing
│   ├── camera/[id]/          # Camera phone page
│   ├── viewer/[id]/          # Viewer phone page
│   ├── recordings/           # Recordings list
│   └── auth/callback/        # Supabase auth callback
├── components/
│   ├── ui.tsx                # Shared UI components
│   └── Navbar.tsx
├── lib/
│   ├── supabase/             # Supabase clients
│   ├── webrtc.ts             # WebRTC signaling & recorder
│   └── constants.ts
└── types/
    └── database.ts           # TypeScript types
supabase/
└── schema.sql                # Full database schema + RLS
```

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: My Phone Camera Sync"
git remote add origin https://github.com/your-username/my-phone-camera-sync.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` → your Vercel URL (e.g. `https://my-camera-sync.vercel.app`)

### 3. Update Supabase Auth URLs

In Supabase **Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

### 4. Deploy

Vercel deploys automatically on push. Your app will be live at your Vercel URL.

> **Note:** WebRTC requires HTTPS in production. Vercel provides HTTPS automatically. Camera access also requires a secure context (HTTPS or localhost).

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data |
| `devices` | Registered camera/viewer devices |
| `device_pairings` | Pairing codes and paired device links |
| `stream_sessions` | Active/ended streaming sessions |
| `signaling_messages` | WebRTC offers, answers, ICE candidates |
| `recordings` | Recording metadata |

All tables have Row Level Security — users can only access their own data.

---

## Error Handling

The app handles these scenarios with clear user messages:

- Camera permission denied
- Browser lacks WebRTC or MediaRecorder support
- WebRTC connection failed
- Upload failed
- Supabase errors
- Device not paired
- Pairing code expired
- Recording blocked when camera is off

---

## Security Notes

- Camera and microphone are **never** accessed automatically
- Recording requires an explicit button click with a visible indicator
- All API access goes through Supabase RLS — no public data
- Signaling messages are cleaned up when sessions end
- Media tracks are stopped when the user leaves the page
- Storage files are scoped to `{user_id}/` paths with RLS policies
- Recordings use signed URLs (private bucket)

---

## Browser Requirements

- Modern mobile browser (Chrome, Safari, Firefox)
- HTTPS (or localhost for development)
- Camera and microphone permissions
- WebRTC and MediaRecorder support

---

## License

MIT
