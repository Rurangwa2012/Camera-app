"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WebRTCSignaling } from "@/lib/webrtc";
import { checkWebRTCSupport } from "@/lib/constants";
import type { Device, DevicePairing, StreamSession } from "@/types/database";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export default function ViewerPage() {
  const params = useParams();
  const viewerDeviceId = params.id as string;
  const supabase = createClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<WebRTCSignaling | null>(null);

  const [device, setDevice] = useState<Device | null>(null);
  const [pairedCameras, setPairedCameras] = useState<(DevicePairing & { camera?: Device })[]>([]);
  const [activeSessions, setActiveSessions] = useState<StreamSession[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [, setSessionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: deviceData, error: deviceError } = await supabase
      .from("devices")
      .select("*")
      .eq("id", viewerDeviceId)
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
      .eq("viewer_device_id", viewerDeviceId)
      .eq("status", "paired");

    const cameraIds = (pairingsData || []).map((p) => p.camera_device_id);
    let camerasMap: Record<string, Device> = {};
    if (cameraIds.length > 0) {
      const { data: camerasData } = await supabase
        .from("devices")
        .select("*")
        .in("id", cameraIds);
      camerasMap = Object.fromEntries((camerasData || []).map((d) => [d.id, d]));
    }

    const { data: sessionsData } = await supabase
      .from("stream_sessions")
      .select("*")
      .eq("status", "active")
      .eq("is_streaming", true);

    setDevice(deviceData);
    setPairedCameras(
      (pairingsData || []).map((p) => ({
        ...p,
        camera: camerasMap[p.camera_device_id],
      }))
    );
    setActiveSessions(sessionsData || []);
    setLoading(false);
  }, [supabase, viewerDeviceId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    if (!selectedCameraId) {
      setError("Select a camera device");
      return;
    }

    const webrtcCheck = checkWebRTCSupport();
    if (!webrtcCheck.supported) {
      setError(webrtcCheck.error!);
      return;
    }

    const pairing = pairedCameras.find((p) => p.camera_device_id === selectedCameraId);
    if (!pairing) {
      setError("Device not paired");
      return;
    }

    setConnecting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let session = activeSessions.find(
      (s) => s.camera_device_id === selectedCameraId && s.status === "active"
    );

    if (!session) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data: freshSessions } = await supabase
        .from("stream_sessions")
        .select("*")
        .eq("camera_device_id", selectedCameraId)
        .eq("status", "active")
        .eq("is_streaming", true)
        .order("created_at", { ascending: false })
        .limit(1);

      session = freshSessions?.[0] || undefined;
    }

    if (!session) {
      setError("No active stream from this camera. Start streaming on the camera phone first.");
      setConnecting(false);
      return;
    }

    setSessionId(session.id);

    await supabase
      .from("stream_sessions")
      .update({ viewer_device_id: viewerDeviceId })
      .eq("id", session.id);

    const signaling = new WebRTCSignaling(
      supabase,
      session.id,
      viewerDeviceId,
      user.id,
      false,
      {
        onRemoteStream: (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setConnected(true);
          setConnecting(false);
        },
        onConnectionStateChange: (state) => {
          setConnectionState(state);
          if (state === "disconnected" || state === "failed") {
            setConnected(false);
          }
        },
        onError: (msg) => {
          setError(msg);
          setConnecting(false);
        },
      }
    );

    try {
      await signaling.connect();
      signalingRef.current = signaling;

      await supabase
        .from("devices")
        .update({ is_online: true, last_seen_at: new Date().toISOString() })
        .eq("id", viewerDeviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (signalingRef.current) {
      await signalingRef.current.cleanup();
      signalingRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setConnected(false);
    setConnecting(false);
    setConnectionState("new");
    setSessionId(null);

    await supabase
      .from("devices")
      .update({ is_online: false })
      .eq("id", viewerDeviceId);
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
        title={`Viewer — ${device.name}`}
        subtitle="Watch live stream from a paired camera"
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

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge
          status={connected ? "connected" : "disconnected"}
          label={connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
        />
        {connectionState !== "new" && connectionState !== "connected" && (
          <StatusBadge status="disconnected" label={connectionState} />
        )}
      </div>

      {pairedCameras.length === 0 ? (
        <EmptyState
          title="No paired cameras"
          description="Pair this viewer device with a camera phone first."
          action={
            <Link href="/pairing">
              <Button>Pair Devices</Button>
            </Link>
          }
        />
      ) : (
        <>
          {!connected && (
            <Card className="mb-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Select Camera
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Choose a camera...</option>
                    {pairedCameras.map((p) => (
                      <option key={p.camera_device_id} value={p.camera_device_id}>
                        {p.camera?.name || "Camera"}
                        {activeSessions.some((s) => s.camera_device_id === p.camera_device_id)
                          ? " (streaming)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="lg"
                  onClick={connect}
                  disabled={connecting || !selectedCameraId}
                  className="w-full"
                >
                  {connecting ? "Connecting..." : "Connect to Stream"}
                </Button>
              </div>
            </Card>
          )}

          <Card className="mb-4 overflow-hidden !p-0">
            <div className="relative aspect-video bg-slate-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
              {!connected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <span className="mb-2 text-5xl">👁</span>
                  <p className="text-sm opacity-70">
                    {connecting ? "Connecting to stream..." : "No active stream"}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {connected && (
            <Button size="lg" variant="danger" onClick={disconnect} className="w-full">
              Disconnect
            </Button>
          )}
        </>
      )}
    </div>
  );
}
