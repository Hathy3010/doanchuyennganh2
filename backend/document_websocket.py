"""
Document WebSocket Manager
Handles realtime document sharing notifications and attendance warnings.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect
from bson import ObjectId

from database import (
    classes_collection, users_collection, pending_notifications_collection
)

logger = logging.getLogger("document_websocket")


class DocumentConnectionManager:
    """
    Extended connection manager for document sharing and attendance notifications.
    Supports both teacher and student connections with room-based broadcasting.
    """
    
    def __init__(self):
        # User connections: user_id -> WebSocket
        self.user_connections: Dict[str, WebSocket] = {}
        
        # Document rooms: document_id -> Set[user_id]
        self.document_rooms: Dict[str, Set[str]] = {}
        
        # Class rooms: class_id -> Set[user_id]
        self.class_rooms: Dict[str, Set[str]] = {}
        
        # User roles cache: user_id -> role
        self.user_roles: Dict[str, str] = {}
    
    # ==================== Connection Management ====================
    
    async def connect(self, websocket: WebSocket, user_id: str, role: str = "student"):
        """Connect a user to WebSocket"""
        await websocket.accept()
        self.user_connections[user_id] = websocket
        self.user_roles[user_id] = role
        logger.info(f"✅ User {user_id} ({role}) connected to document WebSocket")
    
    def disconnect(self, user_id: str):
        """Disconnect a user and clean up rooms"""
        if user_id in self.user_connections:
            del self.user_connections[user_id]
        
        if user_id in self.user_roles:
            del self.user_roles[user_id]
        
        # Remove from all document rooms
        for room_users in self.document_rooms.values():
            room_users.discard(user_id)
        
        # Remove from all class rooms
        for room_users in self.class_rooms.values():
            room_users.discard(user_id)
        
        logger.info(f"📴 User {user_id} disconnected from document WebSocket")
    
    def is_connected(self, user_id: str) -> bool:
        """Check if user is connected"""
        return user_id in self.user_connections
    
    # ==================== Room Management ====================
    
    def join_document_room(self, user_id: str, document_id: str):
        """Join a document room for realtime updates"""
        if document_id not in self.document_rooms:
            self.document_rooms[document_id] = set()
        self.document_rooms[document_id].add(user_id)
        logger.info(f"👤 User {user_id} joined document room {document_id}")
    
    def leave_document_room(self, user_id: str, document_id: str):
        """Leave a document room"""
        if document_id in self.document_rooms:
            self.document_rooms[document_id].discard(user_id)
            logger.info(f"👤 User {user_id} left document room {document_id}")
    
    def join_class_room(self, user_id: str, class_id: str):
        """Join a class room for class-wide notifications"""
        if class_id not in self.class_rooms:
            self.class_rooms[class_id] = set()
        self.class_rooms[class_id].add(user_id)
        logger.info(f"👤 User {user_id} joined class room {class_id}")
    
    def leave_class_room(self, user_id: str, class_id: str):
        """Leave a class room"""
        if class_id in self.class_rooms:
            self.class_rooms[class_id].discard(user_id)
            logger.info(f"👤 User {user_id} left class room {class_id}")
    
    # ==================== Message Sending ====================
    
    async def send_to_user(self, user_id: str, message: dict) -> bool:
        """Send message to a specific user"""
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                self.disconnect(user_id)
        return False
    
    async def broadcast_to_document_room(self, document_id: str, message: dict, exclude_user: str = None):
        """Broadcast message to all users in a document room"""
        if document_id not in self.document_rooms:
            return
        
        for user_id in self.document_rooms[document_id]:
            if user_id != exclude_user:
                await self.send_to_user(user_id, message)
    
    async def broadcast_to_class(self, class_id: str, message: dict, exclude_user: str = None):
        """Broadcast message to all users in a class room"""
        if class_id not in self.class_rooms:
            return
        
        for user_id in self.class_rooms[class_id]:
            if user_id != exclude_user:
                await self.send_to_user(user_id, message)
    
    async def broadcast_to_class_students(self, class_id: str, message: dict):
        """Broadcast to all enrolled students in a class (online or store for offline)"""
        try:
            # Get class info
            class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
            if not class_doc:
                logger.warning(f"Class {class_id} not found")
                return
            
            student_ids = class_doc.get("student_ids", [])
            
            for student_id in student_ids:
                student_id_str = str(student_id)
                
                if self.is_connected(student_id_str):
                    # Send directly
                    await self.send_to_user(student_id_str, message)
                    logger.info(f"📤 Sent notification to online student {student_id_str}")
                else:
                    # Store for offline delivery
                    await self._store_pending_notification(student_id_str, message)
                    logger.info(f"📥 Stored notification for offline student {student_id_str}")
        
        except Exception as e:
            logger.error(f"Error broadcasting to class students: {e}")
    
    async def _store_pending_notification(self, user_id: str, message: dict):
        """Store notification for offline user"""
        await pending_notifications_collection.insert_one({
            "user_id": user_id,
            "message": message,
            "created_at": datetime.utcnow(),
            "delivered": False
        })
    
    async def send_pending_notifications(self, user_id: str) -> int:
        """Send all pending notifications to a user who just connected"""
        try:
            cursor = pending_notifications_collection.find({
                "user_id": user_id,
                "delivered": False
            }).sort("created_at", 1)
            
            count = 0
            async for notification in cursor:
                success = await self.send_to_user(user_id, notification["message"])
                if success:
                    await pending_notifications_collection.update_one(
                        {"_id": notification["_id"]},
                        {"$set": {"delivered": True, "delivered_at": datetime.utcnow()}}
                    )
                    count += 1
            
            if count > 0:
                logger.info(f"📬 Delivered {count} pending notifications to user {user_id}")
            
            return count
        
        except Exception as e:
            logger.error(f"Error sending pending notifications: {e}")
            return 0


# Global document connection manager instance
document_manager = DocumentConnectionManager()


# ==================== Notification Functions ====================

async def notify_document_shared(
    class_id: str,
    document_id: str,
    title: str,
    teacher_name: str,
    class_name: str
):
    """
    Notify all students in a class that a new document has been shared.
    Requirements: 2.1, 2.2, 2.4
    """
    notification = {
        "type": "document_shared",
        "document_id": document_id,
        "title": title,
        "teacher_name": teacher_name,
        "class_name": class_name,
        "class_id": class_id,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await document_manager.broadcast_to_class_students(class_id, notification)
    logger.info(f"📢 Document shared notification sent for '{title}' in class {class_name}")


async def notify_session_report_ready(
    class_id: str,
    class_name: str,
    report_date: str,
    attendance_rate: float,
    teacher_id: str
):
    """
    Notify teacher that session report is ready.
    Requirements: 11.7
    """
    notification = {
        "type": "session_report_ready",
        "class_id": class_id,
        "class_name": class_name,
        "date": report_date,
        "attendance_rate": attendance_rate,
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"Báo cáo điểm danh ngày {report_date} đã sẵn sàng. Tỷ lệ: {attendance_rate}%"
    }
    
    success = await document_manager.send_to_user(teacher_id, notification)
    
    if not success:
        # Store for offline delivery
        await document_manager._store_pending_notification(teacher_id, notification)
    
    logger.info(f"📊 Session report notification sent to teacher {teacher_id}")


async def notify_attendance_warning(
    student_id: str,
    class_id: str,
    class_name: str,
    attendance_rate: float,
    remaining_absences: int
):
    """
    Notify student about low attendance rate.
    Requirements: 13.3
    """
    notification = {
        "type": "attendance_warning",
        "class_id": class_id,
        "class_name": class_name,
        "attendance_rate": attendance_rate,
        "remaining_absences": remaining_absences,
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"⚠️ Cảnh báo: Tỷ lệ điểm danh của bạn trong lớp {class_name} là {attendance_rate}% (dưới 80%). Bạn còn {remaining_absences} buổi vắng được phép."
    }
    
    success = await document_manager.send_to_user(student_id, notification)
    
    if not success:
        # Store for offline delivery
        await document_manager._store_pending_notification(student_id, notification)
    
    logger.info(f"⚠️ Attendance warning sent to student {student_id}")


async def check_and_send_attendance_warnings(class_id: str):
    """
    Check all students in a class and send warnings if attendance < 80%.
    Called after attendance is recorded.
    """
    from attendance_stats_service import attendance_stats_service, AT_RISK_THRESHOLD
    
    try:
        at_risk_students = await attendance_stats_service.get_at_risk_students(class_id)
        
        # Get class name
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        class_name = class_doc.get("class_name", class_doc.get("name", "")) if class_doc else ""
        
        for student in at_risk_students:
            await notify_attendance_warning(
                student_id=student["student_id"],
                class_id=class_id,
                class_name=class_name,
                attendance_rate=student["attendance_rate"],
                remaining_absences=student["remaining_absences"]
            )
        
        logger.info(f"📊 Checked attendance warnings for class {class_id}: {len(at_risk_students)} at-risk students")
    
    except Exception as e:
        logger.error(f"Error checking attendance warnings: {e}")
