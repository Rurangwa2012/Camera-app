-- My Phone Camera Sync - Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- DEVICES
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('camera', 'viewer', 'both')),
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON devices FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- DEVICE PAIRINGS
-- ============================================
CREATE TABLE IF NOT EXISTS device_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  viewer_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  pairing_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  paired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_pairings_user_id ON device_pairings(user_id);
CREATE INDEX idx_device_pairings_code ON device_pairings(pairing_code);
CREATE INDEX idx_device_pairings_camera ON device_pairings(camera_device_id);

ALTER TABLE device_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pairings"
  ON device_pairings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pairings"
  ON device_pairings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pairings"
  ON device_pairings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pairings"
  ON device_pairings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STREAM SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  viewer_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  is_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  is_recording BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX idx_stream_sessions_camera ON stream_sessions(camera_device_id);
CREATE INDEX idx_stream_sessions_status ON stream_sessions(status);

ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stream sessions"
  ON stream_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stream sessions"
  ON stream_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stream sessions"
  ON stream_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stream sessions"
  ON stream_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SIGNALING MESSAGES (WebRTC)
-- ============================================
CREATE TABLE IF NOT EXISTS signaling_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('offer', 'answer', 'ice_candidate')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signaling_session ON signaling_messages(session_id);
CREATE INDEX idx_signaling_created ON signaling_messages(created_at);

ALTER TABLE signaling_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signaling messages"
  ON signaling_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signaling messages"
  ON signaling_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own signaling messages"
  ON signaling_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Enable Realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE signaling_messages;

-- ============================================
-- RECORDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ NOT NULL,
  duration_seconds NUMERIC NOT NULL DEFAULT 0,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_device_id ON recordings(device_id);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings"
  ON recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON recordings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKET FOR RECORDINGS
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false,
  524288000,
  ARRAY['video/webm', 'video/mp4', 'video/ogg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- HELPER: Expire old pairing codes
-- ============================================
CREATE OR REPLACE FUNCTION expire_old_pairings()
RETURNS void AS $$
BEGIN
  UPDATE device_pairings
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER: Clean up old signaling messages
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_signaling()
RETURNS void AS $$
BEGIN
  DELETE FROM signaling_messages
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
