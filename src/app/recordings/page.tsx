"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Recording, Device } from "@/types/database";
import { formatDuration, formatFileSize } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  PageHeader,
} from "@/components/ui";

type RecordingWithDevice = Recording & { device?: Device };

export default function RecordingsPage() {
  const supabase = createClient();
  const [recordings, setRecordings] = useState<RecordingWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  const loadRecordings = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("recordings")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const deviceIds = [...new Set((data || []).map((r) => r.device_id))];
    let devicesMap: Record<string, Device> = {};
    if (deviceIds.length > 0) {
      const { data: devicesData } = await supabase
        .from("devices")
        .select("*")
        .in("id", deviceIds);
      devicesMap = Object.fromEntries((devicesData || []).map((d) => [d.id, d]));
    }

    setRecordings(
      (data || []).map((r) => ({
        ...r,
        device: devicesMap[r.device_id],
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  async function getSignedUrl(recording: RecordingWithDevice): Promise<string> {
    if (videoUrls[recording.id]) return videoUrls[recording.id];

    const { data, error: signError } = await supabase.storage
      .from("recordings")
      .createSignedUrl(recording.file_path, 3600);

    if (signError || !data?.signedUrl) {
      throw new Error(signError?.message || "Failed to get video URL");
    }

    setVideoUrls((prev) => ({ ...prev, [recording.id]: data.signedUrl }));
    return data.signedUrl;
  }

  async function handlePlay(recording: RecordingWithDevice) {
    try {
      await getSignedUrl(recording);
      setPlayingId(recording.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to play recording");
    }
  }

  async function handleDownload(recording: RecordingWithDevice) {
    try {
      const url = await getSignedUrl(recording);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${recording.id}.webm`;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function handleDelete(recording: RecordingWithDevice) {
    if (!confirm("Delete this recording? This cannot be undone.")) return;

    const { error: storageError } = await supabase.storage
      .from("recordings")
      .remove([recording.file_path]);

    if (storageError) {
      setError(`Failed to delete file: ${storageError.message}`);
      return;
    }

    const { error: dbError } = await supabase
      .from("recordings")
      .delete()
      .eq("id", recording.id);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    if (playingId === recording.id) setPlayingId(null);
    await loadRecordings();
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
        title="Recordings"
        subtitle="View, play, and manage your saved recordings"
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

      {recordings.length === 0 ? (
        <EmptyState
          title="No recordings yet"
          description="Recordings appear here after you record from a camera device."
          action={
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => (
            <Card key={recording.id}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {recording.device?.name || "Unknown Device"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(recording.started_at)} ·{" "}
                      {formatDuration(recording.duration_seconds)}
                      {recording.file_size_bytes
                        ? ` · ${formatFileSize(recording.file_size_bytes)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={playingId === recording.id ? "secondary" : "primary"}
                      onClick={() =>
                        playingId === recording.id
                          ? setPlayingId(null)
                          : handlePlay(recording)
                      }
                    >
                      {playingId === recording.id ? "Hide" : "Play"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDownload(recording)}>
                      Download
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(recording)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {playingId === recording.id && videoUrls[recording.id] && (
                  <video
                    src={videoUrls[recording.id]}
                    controls
                    className="w-full rounded-xl"
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
