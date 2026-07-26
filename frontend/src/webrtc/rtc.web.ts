// Web WebRTC bindings. Browsers ship native WebRTC, so unlike react-native-webrtc
// (native-only) we CAN support audio/video calls and live broadcast on the web
// preview by using the browser's RTCPeerConnection + a <video> based RTCView.
import * as React from "react";
import { StyleSheet } from "react-native";

const w: any = typeof window !== "undefined" ? window : {};

export const RTCPeerConnection: any = w.RTCPeerConnection ?? null;
export const RTCIceCandidate: any = w.RTCIceCandidate ?? null;
export const RTCSessionDescription: any = w.RTCSessionDescription ?? null;
export const MediaStream: any = w.MediaStream ?? null;
export const mediaDevices: any =
  typeof navigator !== "undefined" ? (navigator as any).mediaDevices : null;

export const webrtcAvailable = !!(RTCPeerConnection && mediaDevices);

// Renders a browser <video> element and attaches the MediaStream via srcObject.
// Accepts a `stream` prop (MediaStream). The native RTCView uses `streamURL`,
// which we ignore here.
export const RTCView: any = ({ stream, style, objectFit = "cover", mirror = false }: any) => {
  const ref = React.useRef<any>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (el && stream) {
      try {
        el.srcObject = stream;
        const p = el.play?.();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }, [stream]);

  const flat = StyleSheet.flatten(style) || {};
  return React.createElement("video", {
    ref,
    autoPlay: true,
    playsInline: true,
    // Local preview (mirror=true) is muted to avoid echo; remote plays audio.
    muted: mirror,
    style: {
      ...flat,
      objectFit,
      transform: mirror ? "scaleX(-1)" : undefined,
    },
  });
};
