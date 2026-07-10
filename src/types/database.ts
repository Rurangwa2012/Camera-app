export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DeviceType = "camera" | "viewer" | "both";
export type PairingStatus = "pending" | "paired" | "expired";
export type SessionStatus = "active" | "ended";
export type SignalingMessageType = "offer" | "answer" | "ice_candidate";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  name: string;
  device_type: DeviceType;
  is_online: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevicePairing {
  id: string;
  user_id: string;
  camera_device_id: string;
  viewer_device_id: string | null;
  pairing_code: string;
  status: PairingStatus;
  expires_at: string;
  paired_at: string | null;
  created_at: string;
  camera_device?: Device;
  viewer_device?: Device;
}

export interface StreamSession {
  id: string;
  user_id: string;
  camera_device_id: string;
  viewer_device_id: string | null;
  status: SessionStatus;
  is_streaming: boolean;
  is_recording: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface SignalingMessage {
  id: string;
  session_id: string;
  user_id: string;
  sender_device_id: string;
  message_type: SignalingMessageType;
  payload: Json;
  created_at: string;
}

export interface Recording {
  id: string;
  user_id: string;
  device_id: string;
  session_id: string | null;
  file_path: string;
  file_url: string | null;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
  file_size_bytes: number | null;
  created_at: string;
  device?: Device;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: Device;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          device_type: DeviceType;
          is_online?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          device_type?: DeviceType;
          is_online?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      device_pairings: {
        Row: DevicePairing;
        Insert: {
          id?: string;
          user_id: string;
          camera_device_id: string;
          viewer_device_id?: string | null;
          pairing_code: string;
          status?: PairingStatus;
          expires_at: string;
          paired_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          camera_device_id?: string;
          viewer_device_id?: string | null;
          pairing_code?: string;
          status?: PairingStatus;
          expires_at?: string;
          paired_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stream_sessions: {
        Row: StreamSession;
        Insert: {
          id?: string;
          user_id: string;
          camera_device_id: string;
          viewer_device_id?: string | null;
          status?: SessionStatus;
          is_streaming?: boolean;
          is_recording?: boolean;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          camera_device_id?: string;
          viewer_device_id?: string | null;
          status?: SessionStatus;
          is_streaming?: boolean;
          is_recording?: boolean;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      signaling_messages: {
        Row: SignalingMessage;
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          sender_device_id: string;
          message_type: SignalingMessageType;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          sender_device_id?: string;
          message_type?: SignalingMessageType;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      recordings: {
        Row: Recording;
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          session_id?: string | null;
          file_path: string;
          file_url?: string | null;
          started_at: string;
          stopped_at: string;
          duration_seconds: number;
          file_size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          session_id?: string | null;
          file_path?: string;
          file_url?: string | null;
          started_at?: string;
          stopped_at?: string;
          duration_seconds?: number;
          file_size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
