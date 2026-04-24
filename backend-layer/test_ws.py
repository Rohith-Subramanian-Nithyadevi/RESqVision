import asyncio
import websockets
import json
from datetime import datetime
import time

async def test_ws():
    uri = "wss://resqvision-backend.onrender.com/ws/ai"
    async with websockets.connect(uri) as ws:
        payload = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "unix_time": int(time.time()),
            "user_id": "rohith",
            "frame_id": 123,
            "total_detections": 1,
            "detections": [{
                "class_name": "Fall-person",
                "confidence": 0.85,
                "camera_ip": "192.168.1.5"
            }],
            "camera_ip": "192.168.1.5",
            "event_id_prefix": f"evt_192_168_1_5_123",
            "alerts": {
                "emergency_detected": True,
                "severity_level": "HIGH"
            }
        }
        await ws.send(json.dumps(payload))
        print("Sent mock payload:", payload)
        
        # Keep connection open for a second to allow processing
        await asyncio.sleep(2)

asyncio.run(test_ws())
