// Native (iOS/Android) WebRTC bindings. Resolved by Metro on native platforms.
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";

export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
};

// WebRTC requires a native development/production build. It is available here.
export const webrtcAvailable = true;
