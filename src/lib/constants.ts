export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_EXPIRY_MINUTES = 10;

export function generatePairingCode(): string {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getPairingExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + PAIRING_EXPIRY_MINUTES);
  return expiry;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkWebRTCSupport(): { supported: boolean; error?: string } {
  if (typeof window === "undefined") {
    return { supported: false, error: "Not in browser environment" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, error: "Your browser does not support camera access (getUserMedia)" };
  }
  if (typeof RTCPeerConnection === "undefined") {
    return { supported: false, error: "Your browser does not support WebRTC" };
  }
  return { supported: true };
}

export function checkMediaRecorderSupport(): { supported: boolean; mimeType?: string; error?: string } {
  if (typeof window === "undefined") {
    return { supported: false, error: "Not in browser environment" };
  }
  if (typeof MediaRecorder === "undefined") {
    return { supported: false, error: "Your browser does not support MediaRecorder" };
  }
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { supported: true, mimeType: type };
    }
  }
  return { supported: false, error: "No supported video recording format found" };
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
