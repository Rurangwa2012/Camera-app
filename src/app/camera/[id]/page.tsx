"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WebRTCSignaling, StreamRecorder } from "@/lib/webrtc";
import { checkWebRTCSupport, checkMediaRecorderSupport, formatDuration } from "@/lib/constants";
import type { Device, DevicePairing } from "@/types/database";
import {
  Alert,
  Button,
  Card,
  LoadingSpinner,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export default function CameraPage() {
  const params = useParams();
  const deviceId = params.id as string;
  const supabase = createClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<WebRTCSignaling | null>(null);
  const recorderRef = useRef<StreamRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [device, setDevice] = useState<Device | null>(null);
  const [pairings, setPairings] = useState<DevicePairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const loadDevice = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: deviceData, error: deviceError } = await supabase
      .from("devices")
      .select("*")
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .single();

    if (deviceError || !deviceData) {
      setError("Device not found or access denied");
      setLoading(false);
      return;
    }

    const { data: pairingsData } = await supabase
      .from("device_pairings")
      .select("*")
      .eq("camera_device_id", deviceId)
      .eq("status", "paired");

    setDevice(deviceData);
    setPairings(pairingsData || []);
    setLoading(false);
  }, [supabase, deviceId]);

  useEffect(() => {
    loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recording) {
      interval = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording]);

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError(null);

    const webrtcCheck = checkWebRTCSupport();
    if (!webrtcCheck.supported) {
      setError(webrtcCheck.error!);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOn(true);

      await supabase
        .from("devices")
        .update({ is_online: true, last_seen_at: new Date().toISOString() })
        .eq("id", deviceId);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to start camera");
      }
    }
  }

  function stopCamera() {
    if (recording) {
      setError("Stop recording before stopping the camera");
      return;
    }
    if (streaming) {
      stopStreaming();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);

    supabase
      .from("devices")
      .update({ is_online: false })
      .eq("id", deviceId);
  }

  async function startStreaming() {
    if (!cameraOn || !streamRef.current) {
      setError("Start the camera first");
      return;
    }

    if (pairings.length === 0) {
      setError("No paired viewer devices. Pair a device first.");
      return;
    }

    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: session, error: sessionError } = await supabase
      .from("stream_sessions")
      .insert({
        user_id: user.id,
        camera_device_id: deviceId,
        is_streaming: true,
      })
      .select()
      .single();

    if (sessionError || !session) {
      setError(sessionError?.message || "Failed to create stream session");
      return;
    }

    setSessionId(session.id);

    const signaling = new WebRTCSignaling(
      supabase,
      session.id,
      deviceId,
      user.id,
      true,
      {
        onRemoteStream: () => {},
        onConnectionStateChange: (state) => setConnectionState(state),
        onError: (msg) => setError(msg),
      }
    );

    try {
      await signaling.connect(streamRef.current);
      signalingRef.current = signaling;
      setStreaming(true);
      setInfo("Waiting for viewer to connect...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start streaming");
    }
  }

  async function stopStreaming() {
    if (signalingRef.current) {
      await signalingRef.current.cleanup();
      signalingRef.current = null;
    }

    if (sessionId) {
      await supabase
        .from("stream_sessions")
        .update({ status: "ended", is_streaming: false, ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      setSessionId(null);
    }

    setStreaming(false);
    setConnectionState("new");
    setInfo(null);
  }

  async function startRecording() {
    if (!cameraOn || !streamRef.current) {
      setError("Start the camera before recording");
      return;
    }

    const recorderCheck = checkMediaRecorderSupport();
    if (!recorderCheck.supported) {
      setError(recorderCheck.error!);
      return;
    }

    setError(null);
    const recorder = new StreamRecorder(recorderCheck.mimeType!);
    recorder.start(streamRef.current);
    recorderRef.current = recorder;
    setRecording(true);

    if (sessionId) {
      await supabase
        .from("stream_sessions")
        .update({ is_recording: true })
        .eq("id", sessionId);
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;

    setUploading(true);
    setError(null);

    try {
      const { blob, startedAt, stoppedAt, durationSeconds } =
        await recorderRef.current.stop();
      recorderRef.current = null;
      setRecording(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const filePath = `${user.id}/${deviceId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(filePath, blob, { contentType: blob.type });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { error: dbError } = await supabase.from("recordings").insert({
        user_id: user.id,
        device_id: deviceId,
        session_id: sessionId,
        file_path: filePath,
        file_url: null,
        started_at: startedAt.toISOString(),
        stopped_at: stoppedAt.toISOString(),
        duration_seconds: durationSeconds,
        file_size_bytes: blob.size,
      });

      if (dbError) throw new Error(`Failed to save recording: ${dbError.message}`);

      if (sessionId) {
        await supabase
          .from("stream_sessions")
          .update({ is_recording: false })
          .eq("id", sessionId);
      }

      setInfo("Recording saved successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recording");
      setRecording(false);
    } finally {
      setUploading(false);
    }
  }

  function stopAll() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop().catch(() => {});
      recorderRef.current = null;
      setRecording(false);
    }
    if (streaming) {
      stopStreaming();
    }
    if (cameraOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraOn(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!device) {
    return (
      <div>
        <Alert type="error">{error || "Device not found"}</Alert>
        <Link href="/dashboard" className="mt-4 inline-block">
          <Button variant="secondary">← Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Camera — ${device.name}`}
        subtitle="Your camera is off until you tap Start Camera"
        action={
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">← Dashboard</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert type="info" onDismiss={() => setInfo(null)}>{info}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {cameraOn && <StatusBadge status="camera-on" pulse />}
        {streaming && <StatusBadge status="streaming" />}
        {recording && <StatusBadge status="recording" pulse label="REC" />}
        {streaming && connectionState !== "new" && (
          <StatusBadge
            status={connectionState === "connected" ? "connected" : "disconnected"}
            label={connectionState}
          />
        )}
      </div>

      <Card className="mb-6 overflow-hidden !p-0">
        <div className="relative aspect-video bg-slate-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="mb-2 text-5xl">📷</span>
              <p className="text-sm opacity-70">Camera is off</p>
              <p className="mt-1 text-xs opacity-50">Tap &quot;Start Camera&quot; to begin</p>
            </div>
          )}
          {recording && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-white shadow-lg">
              <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
              <span className="text-sm font-bold">REC {formatDuration(recordingDuration)}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {!cameraOn ? (
          <Button size="lg" variant="success" onClick={startCamera} className="sm:col-span-2">
            Start Camera
          </Button>
        ) : (
          <Button size="lg" variant="danger" onClick={stopCamera} disabled={recording}>
            Stop Camera
          </Button>
        )}

        {!streaming ? (
          <Button
            size="lg"
            onClick={startStreaming}
            disabled={!cameraOn || pairings.length === 0}
          >
            Start Streaming
          </Button>
        ) : (
          <Button size="lg" variant="danger" onClick={stopStreaming}>
            Stop Streaming
          </Button>
        )}

        {!recording ? (
          <Button
            size="lg"
            variant="secondary"
            onClick={startRecording}
            disabled={!cameraOn || uploading}
          >
            Start Recording
          </Button>
        ) : (
          <Button size="lg" variant="danger" onClick={stopRecording} disabled={uploading}>
            {uploading ? "Saving..." : "Stop Recording"}
          </Button>
        )}
      </div>

      {pairings.length === 0 && (
        <div className="mt-4">
          <Alert type="warning">
            No paired viewer devices.{" "}
            <Link href="/pairing" className="font-medium underline">
              Pair a device
            </Link>{" "}
            before streaming.
          </Alert>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
        <strong>Safety:</strong> Camera and recording are OFF by default. Nothing is recorded or
        streamed until you explicitly start them. Indicators show when camera and recording are active.
      </div>
    </div>
  );
}
