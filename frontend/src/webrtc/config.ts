// STUN servers for NAT traversal. TURN can be added here for production
// (restrictive networks) by appending { urls, username, credential } entries.
export const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
};
