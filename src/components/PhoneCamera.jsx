
import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

export default function PhoneCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null); // Track the active call
  const [facingMode, setFacingMode] = useState("environment");
  const [connectionCode, setConnectionCode] = useState("");
  const [status, setStatus] = useState("Waiting for laptop to connect...");
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [streamReady, setStreamReady] = useState(false);

  function addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { text, timestamp }]);
  }

  // Start webcam
  useEffect(() => {
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setStreamReady(true);
            addLog("Camera stream ready!");
          };
        }

        // If there's an active call, replace the tracks with the new stream
        if (callRef.current && callRef.current.peerConnection) {
          const senders = callRef.current.peerConnection.getSenders();
          const newTracks = stream.getTracks();
          
          newTracks.forEach(track => {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            }
          });
          
          addLog("Updated call with new camera stream!");
        }
      } catch (error) {
        console.error("Failed to access webcam:", error);
        addLog("Failed to access camera: " + error.message);
      }
    }
    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setStreamReady(false);
    };
  }, [facingMode]);

  // Generate 4-digit code and initialize PeerJS
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] PhoneCamera: Peer creation useEffect running!`);

    // Guard against React StrictMode double-invocation: if peer already exists, skip
    if (peerRef.current) {
      console.log(`[${timestamp}] PhoneCamera: Peer already exists, skipping creation!`);
      return;
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setConnectionCode(code);

    // Initialize PeerJS
    const peer = new Peer(code, {
      debug: 3, // Enable debug logging
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      }
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("✅ Peer connected with ID:", id);
      addLog("Peer connected!");
    });

    peer.on("connection", (conn) => {
      console.log("Incoming connection!");
    });

    peer.on("call", (call) => {
      console.log("📞 Incoming call!");
      addLog("Incoming call received!");
      callRef.current = call; // Save the active call
      if (streamRef.current) { // We don't need to wait for streamReady, just check if stream exists
        console.log("Answering call with stream...");
        console.log("Number of tracks in stream:", streamRef.current.getTracks().length);
        console.log("Video tracks:", streamRef.current.getVideoTracks());
        streamRef.current.getVideoTracks().forEach(track => {
          console.log('Phone sending track — readyState:', track.readyState, 'enabled:', track.enabled, 'muted:', track.muted);
        });
        console.log("Call object on phone:", call);
        // Log the peer connection on the phone too
        if (call.peerConnection) {
          console.log("RTCPeerConnection available on phone!");
        }
        // Create a new MediaStream and add tracks to it (some browsers need this)
        const sendStream = new MediaStream();
        streamRef.current.getTracks().forEach(track => sendStream.addTrack(track));
        console.log('Phone sendStream created with tracks:', sendStream.getTracks());
        call.answer(sendStream);
        setStatus("Connected — streaming");
        setIsConnected(true);
        addLog("Call answered! Streaming to laptop!");
      } else {
        console.error("No stream available to answer call!");
        addLog("Error: No camera stream available!");
      }

      call.on("stream", (remoteStream) => {
        console.log("Received remote stream (but we shouldn't need this)!");
      });

      call.on("iceCandidate", (candidate) => {
        console.log("ICE candidate received:", candidate);
      });

      call.on("iceStateChanged", (state) => {
        console.log("ICE state changed:", state);
        addLog("ICE state: " + state);
      });

      call.on("connectionStateChanged", (state) => {
        console.log("Call connection state:", state);
        addLog("Call state: " + state);
      });

      call.on("close", () => {
        console.log("Call ended");
        setStatus("Call ended");
        setIsConnected(false);
        callRef.current = null; // Clear the active call ref
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
        addLog("Call error: " + err.message);
      });
    });

    peer.on("error", (err) => {
      console.error("❌ Peer error:", err);
      setStatus("Error: " + err.message);
      addLog("Peer error: " + err.message);
    });

    return () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] PhoneCamera: Peer creation useEffect CLEANUP running, destroying peer!`);
      peer.destroy();
      peerRef.current = null; // Also clear the ref on cleanup
    };
  }, []); // No dependencies, so this runs once on mount

  function switchCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="text-center">
          <div className="inline-flex items-center rounded-full bg-[#1e3932] px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-50">
            <span className="relative inline-block pr-16 pt-1">
              <span>SEATMASTER PHONE CAMERA</span>
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[#1e3932]">
            Phone Camera Streamer
          </h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Point this phone at the seats, then enter the code below on your laptop
          </p>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-2">Connection Code</p>
            <p className="text-6xl font-bold text-[#00754a] tracking-widest">
              {connectionCode}
            </p>
            <p className="mt-4 text-base text-[#1e3932] font-medium">
              {status}
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <button
              onClick={switchCamera}
              className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-soft transition-all bg-white text-[#1e3932] ring-1 ring-[#cbe7dd]"
            >
              Switch to {facingMode === "user" ? "Back" : "Front"} Camera
            </button>
          </div>

          <div className="relative inline-block mx-auto block">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => console.log('PHONE VIDEO METADATA — width:', videoRef.current.videoWidth, 'height:', videoRef.current.videoHeight)}
              className="max-w-full rounded-2xl"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-[#1e3932] mb-2">
              Connection Log
            </h3>
            <div className="bg-gray-100 rounded-2xl p-4 max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">Waiting for connection...</p>
              ) : (
                logs
                  .slice(-20)
                  .reverse()
                  .map((log, i) => (
                    <p key={i} className="text-sm">
                      <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                      {log.text}
                    </p>
                  ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
