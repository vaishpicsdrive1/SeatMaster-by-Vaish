import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { updateSeatStatus, getSeats } from "../dataClient";

const TOTAL_SEATS = 10;

export default function CameraDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [zones, setZones] = useState([]);
  const [detections, setDetections] = useState([]);
  const [seatStatuses, setSeatStatuses] = useState({});
  const [statusHistory, setStatusHistory] = useState({});
  const [logs, setLogs] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState(null);
  const [pendingSeats, setPendingSeats] = useState(new Set());

  const detectionIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Load model
  useEffect(() => {
    async function loadModel() {
      try {
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        addLog("Model loaded successfully!");
      } catch (error) {
        console.error("Failed to load model:", error);
        addLog("Failed to load model: " + error.message);
      }
    }
    loadModel();
  }, []);

  // Load existing seat statuses
  useEffect(() => {
    async function loadInitialSeats() {
      const { data } = await getSeats();
      const initialStatuses = {};
      data.forEach(seat => {
        initialStatuses[seat.seatId] = seat.status || "free";
      });
      // Initialize all 1-10 seats if not present
      for (let i = 1; i <= TOTAL_SEATS; i++) {
        if (!initialStatuses[i]) initialStatuses[i] = "free";
      }
      setSeatStatuses(initialStatuses);
    }
    loadInitialSeats();
  }, []);

  // Start webcam
  useEffect(() => {
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Failed to access webcam:", error);
        addLog("Failed to access webcam: " + error.message);
      }
    }
    startWebcam();
  }, []);

  // Draw canvas
  useEffect(() => {
    function drawCanvas() {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw detection boxes
      detections.forEach(det => {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3]);
        ctx.fillStyle = "#00ffff";
        ctx.font = "12px Arial";
        ctx.fillText(
          `${det.class} (${Math.round(det.score * 100)}%)`,
          det.bbox[0],
          det.bbox[1] > 10 ? det.bbox[1] - 5 : 10
        );
      });

      // Draw zones
      zones.forEach(zone => {
        const isOccupied = seatStatuses[zone.seatId] === "occupied";
        ctx.strokeStyle = isOccupied ? "#ff0000" : "#00ff00";
        ctx.fillStyle = isOccupied
          ? "rgba(255, 0, 0, 0.2)"
          : "rgba(0, 255, 0, 0.2)";
        ctx.lineWidth = 2;
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        ctx.fillStyle = isOccupied ? "#ffffff" : "#000000";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          `Seat ${zone.seatId}`,
          zone.x + zone.width / 2,
          zone.y + zone.height / 2 + 5
        );
      });

      // Draw current draw rect
      if (isDrawing && drawRect) {
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          drawRect.x,
          drawRect.y,
          drawRect.width,
          drawRect.height
        );
        ctx.setLineDash([]);
      }

      animationFrameRef.current = requestAnimationFrame(drawCanvas);
    }
    drawCanvas();
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [zones, detections, isDrawing, drawRect, seatStatuses]);

  // Detection loop
  useEffect(() => {
    if (!isDetecting || !model) return;

    const runDetection = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      const predictions = await model.detect(video);
      const people = predictions.filter(
        (p) => p.class === "person"
      );
      setDetections(people);

      // Check each zone
      const newStatuses = { ...seatStatuses };
      const newHistory = { ...statusHistory };

      zones.forEach(zone => {
        const zoneCenterX = zone.x + zone.width / 2;
        const zoneCenterY = zone.y + zone.height / 2;

        let isOccupied = false;
        people.forEach(person => {
          const personCenterX = person.bbox[0] + person.bbox[2] / 2;
          const personCenterY = person.bbox[1] + person.bbox[3] / 2;

          if (
            personCenterX >= zone.x &&
            personCenterX <= zone.x + zone.width &&
            personCenterY >= zone.y &&
            personCenterY <= zone.y + zone.height
          ) {
            isOccupied = true;
          }
        });

        const currentStatus = isOccupied ? "occupied" : "free";

        // Update history
        if (!newHistory[zone.seatId]) {
          newHistory[zone.seatId] = [];
        }
        newHistory[zone.seatId].push(currentStatus);
        if (newHistory[zone.seatId].length > 3) {
          newHistory[zone.seatId].shift();
        }

        // Debounce check
        if (newHistory[zone.seatId].length >= 3) {
          const allSame = newHistory[zone.seatId].every(
            (s) => s === newHistory[zone.seatId][0]
          );
          if (allSame && newStatuses[zone.seatId] !== currentStatus) {
            newStatuses[zone.seatId] = currentStatus;
            handleSeatUpdate(zone.seatId, currentStatus);
            addLog(
              `Seat ${zone.seatId}: ${currentStatus} (detected now)`
            );
          }
        }
      });

      setStatusHistory(newHistory);
      setSeatStatuses(newStatuses);
    };

    detectionIntervalRef.current = setInterval(runDetection, 1000);
    return () => {
      if (detectionIntervalRef.current)
        clearInterval(detectionIntervalRef.current);
    };
  }, [isDetecting, model, zones, seatStatuses, statusHistory]);

  function addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { text, timestamp }]);
  }

  async function handleSeatUpdate(seatId, status) {
    setPendingSeats((prev) => new Set(prev).add(seatId));
    try {
      await updateSeatStatus(seatId, status);
    } catch (error) {
      console.error("Failed to update seat:", error);
      addLog(`Failed to update seat ${seatId}: ${error.message}`);
    } finally {
      setPendingSeats((prev) => {
        const newSet = new Set(prev);
        newSet.delete(seatId);
        return newSet;
      });
    }
  }

  // Drawing handlers
  function getMousePos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleMouseDown(e) {
    if (!isCalibrating) return;
    const pos = getMousePos(e);
    setIsDrawing(true);
    setDrawStart(pos);
  }

  function handleMouseMove(e) {
    if (!isDrawing || !isCalibrating) return;
    const pos = getMousePos(e);
    const rect = {
      x: Math.min(pos.x, drawStart.x),
      y: Math.min(pos.y, drawStart.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    };
    setDrawRect(rect);
  }

  function handleMouseUp() {
    if (!isDrawing || !isCalibrating) return;
    setIsDrawing(false);

    if (drawRect && drawRect.width > 10 && drawRect.height > 10) {
      const seatId = prompt("Enter seat ID (1-10):");
      if (seatId) {
        const parsedId = parseInt(seatId);
        if (parsedId >= 1 && parsedId <= TOTAL_SEATS) {
          setZones((prev) => [
            ...prev.filter(z => z.seatId !== parsedId),
            { ...drawRect, seatId: parsedId },
          ]);
        }
      }
    }
    setDrawRect(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="text-center">
          <div className="inline-flex items-center rounded-full bg-[#1e3932] px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-50">
            <span className="relative inline-block pr-16 pt-1">
              <span>SEATMASTER AI DETECTOR</span>
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[#1e3932]">
            AI Camera Detector
          </h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Use your webcam to detect seat occupancy
          </p>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-[#cbe7dd]">
          <div className="flex gap-4 flex-wrap mb-4">
            <button
              onClick={() => setIsCalibrating(!isCalibrating)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-soft transition-all ${
                isCalibrating
                  ? "bg-blue-600 text-white"
                  : "bg-white text-[#1e3932] ring-1 ring-[#cbe7dd]"
              }`}
            >
              {isCalibrating ? "Stop Calibration" : "Calibration Mode"}
            </button>
            <button
              onClick={() => setIsDetecting(!isDetecting)}
              disabled={!model || zones.length === 0}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-soft transition-all ${
                isDetecting
                  ? "bg-red-600 text-white"
                  : "bg-[#00754a] text-white"
              } ${
                (!model || zones.length === 0) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isDetecting ? "Stop Detection" : "Start Detection"}
            </button>
          </div>

          <div className="relative inline-block">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full rounded-2xl"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 max-w-full rounded-2xl"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-[#1e3932] mb-2">
              Seat Status Log
            </h3>
            <div className="bg-gray-100 rounded-2xl p-4 max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">No logs yet...</p>
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

          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
            {Array.from({ length: TOTAL_SEATS }, (_, i) => i + 1).map(
              (seatId) => (
                <div
                  key={seatId}
                  className={`rounded-2xl p-3 text-center text-sm font-semibold ${
                    seatStatuses[seatId] === "occupied"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  Seat {seatId}: {seatStatuses[seatId]}
                </div>
              )
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400">
          Requires HTTPS or localhost for webcam access
        </footer>
      </main>
    </div>
  );
}
