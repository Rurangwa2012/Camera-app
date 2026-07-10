"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Device, DevicePairing } from "@/types/database";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export default function DashboardPage() {
  const supabase = createClient();
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairings, setPairings] = useState<DevicePairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceType, setNewDeviceType] = useState<"camera" | "viewer" | "both">("both");
  const [addingDevice, setAddingDevice] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    const { data: devicesData, error: devicesError } = await supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false });

    if (devicesError) {
      setError(devicesError.message);
      setLoading(false);
      return;
    }

    const { data: pairingsData } = await supabase
      .from("device_pairings")
      .select("*")
      .eq("status", "paired")
      .order("paired_at", { ascending: false });

    setDevices(devicesData || []);
    setPairings(pairingsData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    setAddingDevice(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setAddingDevice(false);
      return;
    }

    const { error: insertError } = await supabase.from("devices").insert({
      user_id: user.id,
      name: newDeviceName.trim(),
      device_type: newDeviceType,
    });

    if (insertError) {
      setError(insertError.message);
      setAddingDevice(false);
      return;
    }

    setNewDeviceName("");
    setShowAddForm(false);
    setAddingDevice(false);
    await loadData();
  }

  async function handleDeleteDevice(id: string) {
    if (!confirm("Delete this device? This cannot be undone.")) return;

    const { error: deleteError } = await supabase.from("devices").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadData();
  }

  function getPairedViewerCount(cameraDeviceId: string): number {
    return pairings.filter((p) => p.camera_device_id === cameraDeviceId).length;
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
        title="Dashboard"
        subtitle="Manage your devices and start streaming"
        action={
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? "Cancel" : "+ Add Device"}
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      )}

      {showAddForm && (
        <Card className="mb-6" title="Add New Device">
          <form onSubmit={handleAddDevice} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Device Name
              </label>
              <input
                type="text"
                required
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g. My iPhone, Kitchen Tablet"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Device Type
              </label>
              <select
                value={newDeviceType}
                onChange={(e) => setNewDeviceType(e.target.value as typeof newDeviceType)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="both">Both (Camera & Viewer)</option>
                <option value="camera">Camera Only</option>
                <option value="viewer">Viewer Only</option>
              </select>
            </div>
            <Button type="submit" disabled={addingDevice}>
              {addingDevice ? "Adding..." : "Add Device"}
            </Button>
          </form>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Link href="/pairing">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🔗</span>
              <div>
                <h3 className="font-semibold text-slate-900">Pair Devices</h3>
                <p className="text-sm text-slate-500">Connect camera & viewer phones</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/recordings">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎬</span>
              <div>
                <h3 className="font-semibold text-slate-900">Recordings</h3>
                <p className="text-sm text-slate-500">View and manage saved videos</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-slate-900">Your Devices</h2>

      {devices.length === 0 ? (
        <EmptyState
          title="No devices yet"
          description="Add a device to get started. You'll need at least one camera phone and one viewer phone."
          action={
            <Button onClick={() => setShowAddForm(true)}>Add Your First Device</Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {devices.map((device) => (
            <Card key={device.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{device.name}</h3>
                    <StatusBadge status={device.is_online ? "online" : "offline"} />
                  </div>
                  <p className="mt-1 text-sm capitalize text-slate-500">
                    {device.device_type} device
                    {device.device_type !== "viewer" &&
                      getPairedViewerCount(device.id) > 0 &&
                      ` · ${getPairedViewerCount(device.id)} paired viewer(s)`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(device.device_type === "camera" || device.device_type === "both") && (
                    <Link href={`/camera/${device.id}`}>
                      <Button variant="success" size="sm">
                        📷 Camera
                      </Button>
                    </Link>
                  )}
                  {(device.device_type === "viewer" || device.device_type === "both") && (
                    <Link href={`/viewer/${device.id}`}>
                      <Button variant="primary" size="sm">
                        👁 Viewer
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDevice(device.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
