import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://rohithsn18_db_user:resqvision@cluster0.faxvqqh.mongodb.net/?appName=Cluster0")

async def test_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.sos_database
    print("Configurations:")
    async for config in db.configurations.find():
        print(config)
        
    print("\nAlerts:")
    async for alert in db.alerts.find().sort("created_at", -1).limit(5):
        print(alert)

asyncio.run(test_db())
