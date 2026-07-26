// Native (iOS/Android) WebRTC bindings. Resolved by Metro on native platforms.
//
// IMPORTANT: react-native-webrtc is a native module that is NOT bundled in Expo Go.
// If we import/use it inside Expo Go the app crashes. We therefore:
//   1) detect Expo Go via expo-constants and skip loading, and
//   2) wrap the require in try/catch so a missing native module degrades gracefully.
// In that case `webrtcAvailable` is false and the call/live screens show a clear
// "requires a native build" message instead of crashing.
import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

let mod: any = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("react-native-webrtc");
  } catch (e) {
    mod = null;
  }
}

export const RTCPeerConnection: any = mod?.RTCPeerConnection ?? null;
export const RTCIceCandidate: any = mod?.RTCIceCandidate ?? null;
export const RTCSessionDescription: any = mod?.RTCSessionDescription ?? null;
export const RTCView: any = mod?.RTCView ?? (() => null);
export const mediaDevices: any = mod?.mediaDevices ?? null;
export const MediaStream: any = mod?.MediaStream ?? null;

// True only when the native WebRTC module is actually available (dev/prod build).
export const webrtcAvailable = !!(mod && mod.RTCPeerConnection && mod.mediaDevices);
