import cv2
import json
import time
import asyncio
import websockets
import threading
import queue
import socket
import sounddevice as sd
from vosk import Model, KaldiRecognizer
import pyttsx3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from datetime import datetime
from fastapi.responses import StreamingResponse

# --- Configuration ---
MODEL_A_PATH = "besta.pt" 
MODEL_F_PATH = "best_ff.pt"
WEBSOCKET_URL = "ws://localhost:8000/ws/ai"
WS_QUEUE_SIZE = 100

# --- Global State ---
active_cameras = {}
camera_states = {}  
annotated_frames = {}
current_user_id = "unknown"
frames_lock = threading.Lock()
cameras_lock = threading.Lock()
ws_queue = queue.Queue(maxsize=WS_QUEUE_SIZE)
SHUTDOWN_EVENT = threading.Event()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
def speak_response(text):
    def target():
        engine = pyttsx3.init()
        engine.say(text)
        engine.runAndWait()
    threading.Thread(target=target).start()

def audio_listener_thread():
    try:
        # 1. Load the model (ensure the folder 'model' is in your directory)
        model = Model("model") 
        rec = KaldiRecognizer(model, 16000)
        
        print(" Audio SOS Active (Vosk + SoundDevice). Listening...")

        # 2. Open the audio stream
        with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype='int16',
                               channels=1) as stream:
            while not SHUTDOWN_EVENT.is_set():
                data, overflowed = stream.read(8000)
                if rec.AcceptWaveform(bytes(data)):
                    result = json.loads(rec.Result())
                    text = result.get("text", "").lower()
                    
                    if "help" in text:
                        print(f"\n ALERT: Voice SOS Triggered by keyword: '{text}'")
                        print(f"AUDIO SOS DETECTED: {text}")
                        speak_response("S O S has been triggered, help will be assisted shortly")
                        
                        # Send payload to backend
                        unix_time = int(time.time())
                        payload = {
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "unix_time": unix_time,
                            "user_id": current_user_id,
                            "detections": [{
                                "class_name": "Voice-SOS",
                                "confidence": 1.0,
                                "camera_ip": "Audio-Mic"
                            }],
                            "camera_ip": "Audio-Mic",
                            "alerts": {"emergency_detected": True, "severity_level": "HIGH"}
                        }
                        if not ws_queue.full():
                            ws_queue.put(payload)
    except Exception as e:
        print(f"Audio System Error: {e}")
# --- Optimized Camera Reader ---
class CameraStream:
    def __init__(self, src, ip):
        self.ip = ip
        self.src = src
        self.cap = cv2.VideoCapture(self.src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) 
        self.latest_frame = None
        self.running = True
        self.lock = threading.Lock()
        
        self.thread = threading.Thread(target=self.update, args=(), daemon=True)
        self.thread.start()

    def update(self):
        failed_reads = 0
        while self.running and not SHUTDOWN_EVENT.is_set():
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    with self.lock:
                        self.latest_frame = frame
                    failed_reads = 0
                else:
                    failed_reads += 1
                    if failed_reads > 30:
                        print(f"Lost connection to {self.ip}. Dropping stream.")
                        self.running = False
                        break
                    time.sleep(0.1)
            else:
                time.sleep(1)

    def read(self):
        with self.lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def stop(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=1.0)
        self.cap.release()

# --- Network Scanner ---
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def scan_network_for_cameras(port=8080):
    local_ip = get_local_ip()
    network_prefix = ".".join(local_ip.split(".")[:3]) + "."
    found_cameras = []
    
    print(f"Scanning network: {network_prefix}0/24 on port {port}...")
    
    def check_ip(ip):
        address = f"{network_prefix}{ip}"
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.1)
        result = sock.connect_ex((address, port))
        sock.close()
        if result == 0:
            try:
                url = f"http://{address}:{port}/video"
                cap = cv2.VideoCapture(url)
                if cap.isOpened():
                    found_cameras.append(address)
                    cap.release()
            except:
                pass

    threads = []
    for i in range(1, 255):
        t = threading.Thread(target=check_ip, args=(i,))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
        
    return found_cameras

# --- WebSocket Sender ---
def websocket_sender_thread():
    async def sender_loop():
        while not SHUTDOWN_EVENT.is_set():
            try:
                async with websockets.connect(WEBSOCKET_URL) as ws:
                    print("AI WebSocket Connected to Backend!")
                    while not SHUTDOWN_EVENT.is_set():
                        try:
                            # Use get_nowait to prevent blocking the asyncio event loop
                            payload = ws_queue.get_nowait()
                            await ws.send(json.dumps(payload))
                            await asyncio.sleep(0.01)
                        except queue.Empty:
                            await asyncio.sleep(0.05)
            except Exception as e:
                if not SHUTDOWN_EVENT.is_set():
                    print(f"WS Error: {e}. Retrying in 2s...")
                    await asyncio.sleep(2) # Non-blocking sleep for retry
    try:
        asyncio.run(sender_loop())
    except RuntimeError:
        pass

# --- 
# --- Multi-Camera Inference Loop ---
def inference_loop():
    print("Loading Models...")
    model_a = YOLO(MODEL_A_PATH)
    model_f = YOLO(MODEL_F_PATH)
    model_s = YOLO("yolov8n.pt") # NEW: Standard model for anti-spoofing
    
    TARGET_CLASSES = ["Fire", "Accident", "Violence", "Fall-person", "Unconsciousness","Voice-SOS"]

    while not SHUTDOWN_EVENT.is_set(): 
        with cameras_lock:
            current_ips = list(active_cameras.keys())
        
        if not current_ips:
            time.sleep(1)
            continue

        for ip in current_ips:
            with cameras_lock:
                cam_obj = active_cameras.get(ip)
            if not cam_obj:
                continue

            if not cam_obj.running:
                print(f" Cleaning up disconnected camera: {ip}")
                with cameras_lock:
                    active_cameras.pop(ip, None)
                    camera_states.pop(ip, None)
                with frames_lock:
                    annotated_frames.pop(ip, None)
                continue

            frame = cam_obj.read()
            if frame is None:
                continue

            if ip not in camera_states:
                camera_states[ip] = {"fall_data": {}, "frame_count": 0}
            
            state = camera_states[ip]
            state["frame_count"] += 1
            current_time = time.time()

            frame_resized = cv2.resize(frame, (640, 480))
            display_frame = frame_resized.copy() 
            
            # Run all three models
            results_a = model_a.predict(frame_resized, verbose=False, imgsz=320)
            results_f = model_f.track(frame_resized, persist=True, verbose=False, imgsz=320)
            results_s = model_s.predict(frame_resized, verbose=False, imgsz=320) # Spoof model
            
            current_detections = []
            emergency_detected = False
            spoof_detected = False

            # --- 1. ANTI-SPOOF SWEEP ---
            if results_s[0].boxes is not None:
                for b in results_s[0].boxes:
                    cls = int(b.cls.cpu().numpy()[0])
                    conf = float(b.conf.cpu().numpy()[0])
                    raw_class = model_s.names[cls]
                    
                    if raw_class == 'cell phone' and conf > 0.4:
                        spoof_detected = True
                        box = b.xyxy.cpu().numpy()[0]
                        x1, y1, x2, y2 = map(int, box)
                        
                        # Draw a YELLOW box for the phone to visually show the spoof block
                        cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 255), 3)
                        cv2.putText(display_frame, f"SPOOF ATTEMPT BLOCKED", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                        
                        if state["frame_count"] % 10 == 0:
                            print(f"SPOOF DETECTED: Phone in frame on {ip}. Suppressing emergencies!")
            # ---------------------------

            # --- 2. EMERGENCY SWEEP ---
            combined_list = []
            if results_a[0].boxes is not None:
                for b in results_a[0].boxes:
                    cls = int(b.cls.cpu().numpy()[0])
                    raw_class = model_a.names[cls].capitalize()
                    if raw_class in ["Fire", "Accident"]:
                        combined_list.append((b, model_a))
            if results_f[0].boxes is not None:
                for b in results_f[0].boxes:
                    cls = int(b.cls.cpu().numpy()[0])
                    raw_class = model_f.names[cls].capitalize()
                    if raw_class in ["Fall-person", "Unconsciousness", "Violence"]:
                        combined_list.append((b, model_f))

            for box_obj, active_model in combined_list:
                cls = int(box_obj.cls.cpu().numpy()[0])
                conf = float(box_obj.conf.cpu().numpy()[0])
                box = box_obj.xyxy.cpu().numpy()[0]
                track_id = int(box_obj.id.cpu().numpy()[0]) if box_obj.id is not None else None
                
                raw_class = active_model.names[cls]
                class_name = raw_class.capitalize()
                
                if class_name not in TARGET_CLASSES:
                    continue

                x1, y1, x2, y2 = map(int, box)

                if conf > 0.4: 
                    # --- SPOOF OVERRIDE ---
                    if spoof_detected:
                        # Draw the fire/accident in GRAY so judges see the AI isn't blind, just smart.
                        cv2.rectangle(display_frame, (x1, y1), (x2, y2), (128, 128, 128), 2)
                        cv2.putText(display_frame, f"IGNORED: {class_name}", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 2)
                        continue # This completely stops the SOS from triggering!
                    # ----------------------

                    if state["frame_count"] % 10 == 0:
                        print(f"TARGET DETECTED: {class_name} ({conf*100:.1f}%) on {ip}")

                    if track_id is not None:
                        curr_x, curr_y = (x1 + x2) / 2, (y1 + y2) / 2
                        fall_data = state["fall_data"]
                        
                        if class_name == "Fall-person":
                            if track_id not in fall_data:
                                inherited_id = None
                                for old_id, data in list(fall_data.items()):
                                    old_x, old_y = data['pos']
                                    if ((curr_x - old_x)**2 + (curr_y - old_y)**2)**0.5 < 50:
                                        inherited_id = old_id
                                        break
                                
                                if inherited_id is not None:
                                    fall_data[track_id] = fall_data.pop(inherited_id)
                                else:
                                    fall_data[track_id] = {
                                        'time': current_time,
                                        'pos': (curr_x, curr_y),
                                        'last_seen': current_time
                                    }
                        
                            fall_data[track_id]['last_seen'] = current_time
                            init_x, init_y = fall_data[track_id]['pos']
                            
                            if ((curr_x - init_x)**2 + (curr_y - init_y)**2)**0.5 < 50:
                                if current_time - fall_data[track_id]['time'] >= 10:
                                    class_name = "Unconsciousness"
                        else:
                            if track_id in fall_data:
                                del fall_data[track_id]

                    emergency_detected = True

                    color = (0, 0, 255)
                    cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(display_frame, f"{class_name} {conf:.2f}", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    current_detections.append({
                        "class_name": class_name, 
                        "confidence": conf,
                        "camera_ip": ip
                    })

            stale_ids = [
                tid for tid, d in state["fall_data"].items()
                if current_time - d['last_seen'] > 2.0
            ]
            for tid in stale_ids:
                del state["fall_data"][tid]

            with frames_lock:
                annotated_frames[ip] = display_frame

            if emergency_detected or state["frame_count"] % 30 == 0:
                safe_ip = ip.replace(".", "_")
                payload = {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "unix_time": int(time.time()),
                    "user_id": current_user_id,
                    "frame_id": state["frame_count"],
                    "total_detections": len(current_detections),
                    "detections": current_detections,
                    "camera_ip": ip,
                    "event_id_prefix": f"evt_{safe_ip}_{state['frame_count']}",
                    "alerts": {
                        "emergency_detected": emergency_detected,
                        "severity_level": "HIGH" if emergency_detected else "NONE"
                    }
                }
                if not ws_queue.full():
                    ws_queue.put(payload)
        
        time.sleep(0.01)
# --- API Endpoints ---
@app.get("/scan")
def scan_network():
    cameras = scan_network_for_cameras()
    return {"cameras": cameras}

@app.post("/connect/{ip_suffix}")
def connect_camera(ip_suffix: str, user_id: str = "unknown"):
    global current_user_id
    current_user_id = user_id
    local_ip = get_local_ip()
    network_prefix = ".".join(local_ip.split(".")[:3]) + "."
    full_ip = f"{network_prefix}{ip_suffix}"
    stream_url = f"http://{full_ip}:8080/video"
    
    with cameras_lock:
        if full_ip in active_cameras:
            return {"status": "Already connected"}
    
    print(f"Connecting to {stream_url}...")
    try:
        new_cam = CameraStream(stream_url, full_ip)
        with cameras_lock:
            active_cameras[full_ip] = new_cam
        return {"status": "Connected", "url": stream_url}
    except Exception as e:
        return {"status": "Failed", "error": str(e)}

@app.post("/disconnect/{ip_suffix}")
def disconnect_camera(ip_suffix: str):
    local_ip = get_local_ip()
    network_prefix = ".".join(local_ip.split(".")[:3]) + "."
    full_ip = f"{network_prefix}{ip_suffix}"
    
    with cameras_lock:
        if full_ip in active_cameras:
            active_cameras[full_ip].stop()
            del active_cameras[full_ip]
            camera_states.pop(full_ip, None)
    with frames_lock:
        annotated_frames.pop(full_ip, None)
    
    if full_ip in active_cameras:
        return {"status": "Not found"}
    return {"status": "Disconnected"}

@app.get("/video_feed/{ip_suffix}")
def video_feed(ip_suffix: str):
    local_ip = get_local_ip()
    network_prefix = ".".join(local_ip.split(".")[:3]) + "."
    full_ip = f"{network_prefix}{ip_suffix}"
    
    def iter_frames():
        while not SHUTDOWN_EVENT.is_set():
            with frames_lock:
                frame = annotated_frames.get(full_ip)
            if frame is not None:
                _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 40])
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n'
                    + buffer.tobytes()
                    + b'\r\n'
                )
            time.sleep(0.05)
            
    return StreamingResponse(iter_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.on_event("startup")
def startup():
    threading.Thread(target=inference_loop, daemon=True).start()
    threading.Thread(target=websocket_sender_thread, daemon=True).start()
    threading.Thread(target=audio_listener_thread, daemon=True).start()

@app.on_event("shutdown")
def shutdown():
    print("\nAI Layer receiving shutdown signal...")
    SHUTDOWN_EVENT.set()
    with cameras_lock:
        for ip, cam in list(active_cameras.items()):
            print(f"Releasing camera {ip}...")
            cam.stop()
    print("AI Layer shutdown complete.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)