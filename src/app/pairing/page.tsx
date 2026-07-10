"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { generatePairingCode, getPairingExpiry, getAppUrl } from "@/lib/constants";
import type { Device, DevicePairing } from "@/types/database";
import {
  Alert,
  Button,
  Card,
  LoadingSpinner,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export default function PairingPage() {
  const supabase = createClient();
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairings, setPairings] = useState<DevicePairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [viewerDeviceId, setViewerDeviceId] = useState("");
  const [enterCode, setEnterCode] = useState("");
  const [activePairing, setActivePairing] = useState<DevicePairing | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadData = useCallback(async () => {
    const { data: devicesData } = await supabase
      .from("devices")
      .select("*")
      .order("name");

    const { data: pairingsData } = await supabase
      .from("device_pairings")
      .select("*")
      .order("created_at", { ascending: false });

    setDevices(devicesData || []);
    setPairings(pairingsData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cameraDevices = devices.filter(
    (d) => d.device_type === "camera" || d.device_type === "both"
  );
  const viewerDevices = devices.filter(
    (d) => d.device_type === "viewer" || d.device_type === "both"
  );

  async function handleCreatePairing() {
    if (!cameraDeviceId) {
      setError("Select a camera device");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setCreating(false);
      return;
    }

    const code = generatePairingCode();
    const expiresAt = getPairingExpiry().toISOString();

    const { data, error: insertError } = await supabase
      .from("device_pairings")
      .insert({
        user_id: user.id,
        camera_device_id: cameraDeviceId,
        pairing_code: code,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    setActivePairing(data);
    const pairUrl = `${getAppUrl()}/pairing?code=${code}`;
    const qr = await QRCode.toDataURL(pairUrl, { width: 256, margin: 2 });
    setQrDataUrl(qr);
    setCreating(false);
    setSuccess(`Pairing code created: ${code}`);
    await loadData();
  }

  async function handleJoinPairing() {
    if (!viewerDeviceId || !enterCode.trim()) {
      setError("Select a viewer device and enter the pairing code");
      return;
    }

    setJoining(true);
    setError(null);
    setSuccess(null);

    const { data: pairing, error: fetchError } = await supabase
      .from("device_pairings")
      .select("*")
      .eq("pairing_code", enterCode.trim())
      .eq("status", "pending")
      .single();

    if (fetchError || !pairing) {
      setError("Invalid or expired pairing code");
      setJoining(false);
      return;
    }

    if (new Date(pairing.expires_at) < new Date()) {
      await supabase
        .from("device_pairings")
        .update({ status: "expired" })
        .eq("id", pairing.id);
      setError("Pairing code has expired. Ask for a new code.");
      setJoining(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("device_pairings")
      .update({
        viewer_device_id: viewerDeviceId,
        status: "paired",
        paired_at: new Date().toISOString(),
      })
      .eq("id", pairing.id);

    if (updateError) {
      setError(updateError.message);
      setJoining(false);
      return;
    }

    setSuccess("Devices paired successfully!");
    setEnterCode("");
    setJoining(false);
    await loadData();
  }

  function getDeviceName(id: string): string {
    return devices.find((d) => d.id === id)?.name || "Unknown";
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pair Devices"
        subtitle="Connect your camera phone with a viewer phone"
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
      {success && (
        <div className="mb-4">
          <Alert type="success" onDismiss={() => setSuccess(null)}>{success}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Camera Phone — Create Code" description="Generate a pairing code on your camera device">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Camera Device
              </label>
              <select
                value={cameraDeviceId}
                onChange={(e) => setCameraDeviceId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Select camera device...</option>
                {cameraDevices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleCreatePairing} disabled={creating || !cameraDeviceId} className="w-full">
              {creating ? "Creating..." : "Create Pairing Code"}
            </Button>

            {activePairing && (
              <div className="rounded-xl bg-indigo-50 p-4 text-center">
                <p className="mb-2 text-sm text-indigo-600">Your pairing code</p>
                <p className="text-4xl font-bold tracking-widest text-indigo-900">
                  {activePairing.pairing_code}
                </p>
                <p className="mt-2 text-xs text-indigo-500">
                  Expires in 10 minutes
                </p>
                {qrDataUrl && (
                  <div className="mt-4 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Pairing QR Code" className="rounded-lg" />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Viewer Phone — Enter Code" description="Enter the code from your camera phone">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Viewer Device
              </label>
              <select
                value={viewerDeviceId}
                onChange={(e) => setViewerDeviceId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Select viewer device...</option>
                {viewerDevices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Pairing Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={enterCode}
                onChange={(e) => setEnterCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <Button
              onClick={handleJoinPairing}
              disabled={joining || !viewerDeviceId || enterCode.length < 6}
              className="w-full"
            >
              {joining ? "Pairing..." : "Pair Devices"}
            </Button>
          </div>
        </Card>
      </div>

      {pairings.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Pairing History</h2>
          <div className="space-y-3">
            {pairings.map((p) => (
              <Card key={p.id} className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{getDeviceName(p.camera_device_id)}</span>
                    {" → "}
                    <span className="font-medium">
                      {p.viewer_device_id ? getDeviceName(p.viewer_device_id) : "—"}
                    </span>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
