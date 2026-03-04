#!/usr/bin/env python3
"""
Database Seeding Script for AACA (MongoDB)
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.mongodb_service import mongodb_service
from app.core.security import get_password_hash


USERS = [
    {
        "email": "demo@aaca.app",
        "full_name": "Demo User",
        "password_hash": get_password_hash("demo123"),
        "institution": "Demo University",
        "cognitive_level": "intermediate",
        "preferred_subjects": ["mathematics", "physics"],
        "is_active": True,
        "is_premium": False,
    },
    {
        "email": "student@example.com",
        "full_name": "Test Student",
        "password_hash": get_password_hash("student123"),
        "cognitive_level": "beginner",
        "preferred_subjects": ["chemistry", "biology"],
        "is_active": True,
        "is_premium": True,
    },
]


async def seed_users():
    """Seed users and return their IDs"""
    print("\n👤 Seeding users...")
    user_ids = {}
    
    for user_data in USERS:
        existing = await mongodb_service.get_user_by_email(user_data["email"])
        if existing:
            print(f"  ⚠️  User exists: {user_data['email']}")
            user_ids[user_data["email"]] = existing["id"]
            continue
            
        user_id = await mongodb_service.create_user(user_data)
        user_ids[user_data["email"]] = user_id
        print(f"  ✅ Created: {user_data['email']}")
    
    return user_ids


async def seed_notes(user_ids):
    """Seed sample notes"""
    print("\n📝 Seeding notes...")
    note_ids = {}
    
    notes_data = [
        {
            "user_email": "demo@aaca.app",
            "title": "Introduction to Calculus",
            "subject": "mathematics",
            "raw_text": "Calculus is the study of change...",
            "summary": "Introduction to limits and derivatives.",
        },
        {
            "user_email": "student@example.com",
            "title": "Organic Chemistry Basics",
            "subject": "chemistry",
            "raw_text": "Carbon has 4 valence electrons...",
            "summary": "Introduction to organic chemistry.",
        },
    ]
    
    for note_data in notes_data:
        user_email = note_data.pop("user_email")
        user_id = user_ids.get(user_email)
        
        if not user_id:
            continue
        
        note_data["user_id"] = user_id
        note_data["created_at"] = datetime.now() - timedelta(days=7)
        note_data["updated_at"] = datetime.now() - timedelta(days=7)
        
        note_id = await mongodb_service.create_note(note_data)
        note_ids[note_data["title"]] = note_id
        print(f"  ✅ Created: {note_data['title']}")
    
    return note_ids


async def seed_database():
    """Seed the database with test data"""
    print("🌱 AACA Database Seeding")
    print("=" * 40)
    
    try:
        if mongodb_service.db is None:
            print("❌ MongoDB not connected")
            return 1
        
        user_ids = await seed_users()
        note_ids = await seed_notes(user_ids)
        
        print("\n" + "=" * 40)
        print("✅ Database seeded!")
        print(f"\nTest Accounts:")
        print("  demo@aaca.app / demo123")
        print("  student@example.com / student123")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(seed_database())
    sys.exit(exit_code)
