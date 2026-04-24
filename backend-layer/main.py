from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime
import json
import os
import asyncio
from twilio.rest import Client as TwilioClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN")
TWILIO_PHONE = os.getenv("TWILIO_PHONE")
SENDGRID_KEY = os.getenv("SENDGRID_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "rohithsn18@gmail.com")

mongo_client = AsyncIOMotorClient(MONGO_URI)
db = mongo_client.sos_database
alerts_collection = db.alerts
config_collection = db.configurations

connected_clients: set[WebSocket] = set()
clients_lock = asyncio.Lock()

def send_sms(to_phone, message):
    try:
        if not TWILIO_SID:
            print(f"Mock SMS sent to {to_phone}: {message}")
            return
        twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
        twilio_client.messages.create(body=message, from_=TWILIO_PHONE, to=to_phone)
    except Exception as e:
        print(f"Twilio Error: {e}")

def send_email(to_email, subject, content):
    try:
        if not SENDGRID_KEY:
            print(f"Mock Email sent to {to_email} | Subject: {subject}")
            return
        message = Mail(from_email=FROM_EMAIL, to_emails=to_email, subject=subject, plain_text_content=content)
        sg = SendGridAPIClient(SENDGRID_KEY)
        sg.send(message)
    except Exception as e:
        print(f"SendGrid Error: {e}")

async def process_dynamic_escalation(event_id, class_name, config):
    escalations = config.get("escalations", [])
    escalations.sort(key=lambda x: x.get("level", 1))
    
    # Grab the location string from the DB config
    location_address = config.get("location_address", "Location not specified")

    for esc in escalations:
        delay = int(esc.get("delay_seconds", 0))

        alert = await alerts_collection.find_one({"event_id": event_id})
        if not alert or alert.get("status") != "UNRESOLVED":
            break

        if delay > 0:
            await asyncio.sleep(delay)
            alert = await alerts_collection.find_one({"event_id": event_id})
            if not alert or alert.get("status") != "UNRESOLVED":
                break

        contact = esc.get("contact")
        contact_type = esc.get("type")
        level = esc.get("level")
        send_loc = esc.get("send_location", False) # Check user preference

        # Format string based on user preference
        loc_text = f" | Location: {location_address}" if send_loc else ""

        if contact_type == "sms":
            send_sms(contact, f"EMERGENCY Level {level}: {class_name} detected. Event ID: {event_id}{loc_text}")
        elif contact_type == "gmail":
            send_email(contact, f"URGENT: {class_name} Alert (Level {level})", f"Detected {class_name}. Event ID: {event_id}{loc_text}")

        await alerts_collection.update_one(
            {"event_id": event_id},
            {"$set": {"escalation_level": f"Level {level}"}}
        )

@app.websocket("/ws/ai")
async def ai_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                json_payload = json.loads(data)
            except Exception:
                continue

            if "detections" not in json_payload:
                continue

            authorized_emergency = False

            if json_payload.get("alerts", {}).get("emergency_detected"):
                authorized_detections = []
                
                for det in json_payload.get("detections", []):
                    class_name = det["class_name"]
                    camera_ip = det.get("camera_ip") or json_payload.get("camera_ip", "Unknown")

                    if class_name in ["Fire", "Fall-person", "Accident", "Violence", "Unconsciousness","Voice-SOS"]:
                        config = await config_collection.find_one({"detection_type": class_name})
                        print(f"DB CHECK -> Target: {class_name} | Found Config: {config}")

                        if config and config.get("enabled"):
                            authorized_emergency = True
                            authorized_detections.append(det)

                            existing_active = await alerts_collection.find_one({
                                "class_name": class_name,
                                "camera_id": camera_ip,
                                "status": "UNRESOLVED"
                            })

                            if not existing_active:
                                unix_time = json_payload.get("unix_time", int(datetime.utcnow().timestamp()))
                                event_id_prefix = json_payload.get(
                                    "event_id_prefix",
                                    f"evt_{json_payload.get('frame_id', '0')}_{unix_time}"
                                )
                                event_id = f"{event_id_prefix}_{class_name}"

                                doc = {
                                    "event_id": event_id,
                                    "camera_id": camera_ip,
                                    "class_name": class_name,
                                    "confidence": det["confidence"],
                                    "severity": "HIGH",
                                    "timestamp": json_payload["timestamp"],
                                    "status": "UNRESOLVED",
                                    "escalation_level": "Logged",
                                    "created_at": datetime.utcnow()
                                }
                                await alerts_collection.insert_one(doc)
                                print(f"NEW EMERGENCY: {class_name} on {camera_ip}. Triggering escalation.")
                                asyncio.create_task(
                                    process_dynamic_escalation(event_id, class_name, config)
                                )
                        else:
                            print(f"IGNORED: {class_name}. (Alerts disabled in config)")
                
                # Replace payload with only authorized detections to send to frontend
                json_payload["detections"] = authorized_detections

            if not authorized_emergency or not json_payload.get("detections"):
                json_payload["alerts"]["emergency_detected"] = False

            modified_data = json.dumps(json_payload)

            async with clients_lock:
                snapshot = list(connected_clients)

            dead_clients = []
            for client in snapshot:
                try:
                    await client.send_text(modified_data)
                except Exception:
                    dead_clients.append(client)

            if dead_clients:
                async with clients_lock:
                    for client in dead_clients:
                        connected_clients.discard(client)

    except WebSocketDisconnect:
        pass

@app.websocket("/ws/frontend")
async def frontend_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    async with clients_lock:
        connected_clients.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("action") == "resolve":
                await alerts_collection.update_one(
                    {"event_id": msg.get("event_id")},
                    {"$set": {"status": "RESOLVED", "resolved_at": datetime.utcnow()}}
                )
    except WebSocketDisconnect:
        async with clients_lock:
            connected_clients.discard(websocket)

@app.get("/api/config")
async def get_configs():
    configs = []
    async for doc in config_collection.find():
        doc["_id"] = str(doc["_id"])
        configs.append(doc)
    return configs

@app.post("/api/config")
async def save_config(config: dict):
    detection_type = config.get("detection_type")
    await config_collection.update_one(
        {"detection_type": detection_type},
        {"$set": config},
        upsert=True
    )
    return {"status": "success"}

@app.delete("/api/config/{detection_type}")
async def delete_config(detection_type: str):
    await config_collection.delete_one({"detection_type": detection_type})
    return {"status": "success"}

@app.get("/api/history")
async def get_sos_history():
    incidents = []
    async for doc in alerts_collection.find().sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if isinstance(doc.get("resolved_at"), datetime):
            doc["resolved_at"] = doc["resolved_at"].isoformat()
        incidents.append(doc)
    return incidents

@app.delete("/api/history/{event_id}")
async def delete_sos_incident(event_id: str):
    await alerts_collection.delete_one({"event_id": event_id})
    return {"detail": "Incident deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)