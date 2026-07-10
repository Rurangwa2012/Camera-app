import type { SignalingMessageType, Json } from "@/types/database";
import { STUN_SERVERS } from "./constants";

type Supabase = ReturnType<typeof import("@/lib/supabase/client").createClient>;

export interface SignalingCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: string) => void;
}

export class WebRTCSignaling {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: ReturnType<Supabase["channel"]> | null = null;
  private sessionId: string;
  private deviceId: string;
  private userId: string;
  private supabase: Supabase;
  private callbacks: SignalingCallbacks;
  private isInitiator: boolean;

  constructor(
    supabase: Supabase,
    sessionId: string,
    deviceId: string,
    userId: string,
    isInitiator: boolean,
    callbacks: SignalingCallbacks
  ) {
    this.supabase = supabase;
    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.userId = userId;
    this.isInitiator = isInitiator;
    this.callbacks = callbacks;
  }

  async connect(localStream?: MediaStream): Promise<void> {
    this.localStream = localStream || null;

    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.callbacks.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal("ice_candidate", event.candidate.toJSON());
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream && this.pc) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    this.channel = this.supabase
      .channel(`signaling:${this.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signaling_messages",
          filter: `session_id=eq.${this.sessionId}`,
        },
        async (payload) => {
          const msg = payload.new as {
            sender_device_id: string;
            message_type: SignalingMessageType;
            payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
          };
          if (msg.sender_device_id === this.deviceId) return;
          await this.handleSignal(msg.message_type, msg.payload);
        }
      )
      .subscribe();

    if (this.isInitiator) {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.sendSignal("offer", offer);
    }
  }

  private async handleSignal(
    type: SignalingMessageType,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): Promise<void> {
    if (!this.pc) return;

    try {
      if (type === "offer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.sendSignal("answer", answer);
      } else if (type === "answer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
      } else if (type === "ice_candidate") {
        await this.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
      }
    } catch (err) {
      this.callbacks.onError(
        err instanceof Error ? err.message : "Signaling error"
      );
    }
  }

  private async sendSignal(
    type: SignalingMessageType,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): Promise<void> {
    const { error } = await this.supabase.from("signaling_messages").insert({
      session_id: this.sessionId,
      user_id: this.userId,
      sender_device_id: this.deviceId,
      message_type: type,
      payload: payload as unknown as Json,
    });

    if (error) {
      this.callbacks.onError(`Failed to send signal: ${error.message}`);
    }
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  async cleanup(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    await this.supabase
      .from("signaling_messages")
      .delete()
      .eq("session_id", this.sessionId);
  }
}

export class StreamRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType: string;
  private startTime: Date | null = null;

  constructor(mimeType: string) {
    this.mimeType = mimeType;
  }

  start(stream: MediaStream): void {
    this.chunks = [];
    this.startTime = new Date();
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000);
  }

  stop(): Promise<{ blob: Blob; startedAt: Date; stoppedAt: Date; durationSeconds: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.startTime) {
        reject(new Error("Recorder not started"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const stoppedAt = new Date();
        const durationSeconds = (stoppedAt.getTime() - this.startTime!.getTime()) / 1000;
        const blob = new Blob(this.chunks, { type: this.mimeType });
        resolve({
          blob,
          startedAt: this.startTime!,
          stoppedAt,
          durationSeconds,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}
