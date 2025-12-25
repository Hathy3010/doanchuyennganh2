"""
Notes Service for Realtime Document Sharing
Handles student personal notes on documents with privacy isolation.
"""

import logging
from datetime import datetime
from typing import List
from bson import ObjectId
from fastapi import HTTPException

from database import notes_collection, documents_collection

logger = logging.getLogger("notes_service")

# Configuration
MAX_NOTE_LENGTH = 1000


class NotesService:
    """Service for managing document notes"""
    
    async def create_note(
        self,
        document_id: str,
        student_id: str,
        content: str,
        position: int
    ) -> dict:
        """
        Create a new note.
        
        Args:
            document_id: Document ID
            student_id: Student ID (owner)
            content: Note content (max 1000 chars)
            position: Position in document
            
        Returns:
            Created note dict
        """
        # Validate content length
        if len(content) > MAX_NOTE_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Ghi chú tối đa {MAX_NOTE_LENGTH} ký tự"
            )
        
        if not content.strip():
            raise HTTPException(status_code=400, detail="Nội dung ghi chú không được trống")
        
        # Validate document exists
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        # Validate position
        if position < 0:
            raise HTTPException(status_code=400, detail="Vị trí không hợp lệ")
        
        # Create note
        note = {
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id),
            "content": content.strip(),
            "position": position,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await notes_collection.insert_one(note)
        note["_id"] = result.inserted_id
        
        logger.info(f"📝 Note created: {result.inserted_id} by student {student_id}")
        
        return self._note_to_response(note)
    
    async def get_notes_by_student(
        self,
        document_id: str,
        student_id: str
    ) -> List[dict]:
        """
        Get all notes for a document by a specific student.
        Privacy: Only returns notes owned by the student.
        
        Args:
            document_id: Document ID
            student_id: Student ID
            
        Returns:
            List of notes
        """
        cursor = notes_collection.find({
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id)
        }).sort("position", 1)
        
        notes = []
        async for n in cursor:
            notes.append(self._note_to_response(n))
        
        return notes
    
    async def get_note(self, note_id: str, student_id: str) -> dict:
        """
        Get a single note by ID.
        Privacy: Only returns if owned by the student.
        
        Args:
            note_id: Note ID
            student_id: Student ID
            
        Returns:
            Note dict
        """
        note = await notes_collection.find_one({
            "_id": ObjectId(note_id),
            "student_id": ObjectId(student_id)
        })
        
        if not note:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú")
        
        return self._note_to_response(note)
    
    async def update_note(
        self,
        note_id: str,
        student_id: str,
        content: str
    ) -> dict:
        """
        Update note content.
        Privacy: Only updates if owned by the student.
        
        Args:
            note_id: Note ID
            student_id: Student ID
            content: New content
            
        Returns:
            Updated note dict
        """
        # Validate content length
        if len(content) > MAX_NOTE_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Ghi chú tối đa {MAX_NOTE_LENGTH} ký tự"
            )
        
        if not content.strip():
            raise HTTPException(status_code=400, detail="Nội dung ghi chú không được trống")
        
        result = await notes_collection.update_one(
            {
                "_id": ObjectId(note_id),
                "student_id": ObjectId(student_id)
            },
            {
                "$set": {
                    "content": content.strip(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú")
        
        logger.info(f"📝 Note updated: {note_id}")
        
        return await self.get_note(note_id, student_id)
    
    async def delete_note(self, note_id: str, student_id: str) -> bool:
        """
        Delete a note.
        Privacy: Only deletes if owned by the student.
        
        Args:
            note_id: Note ID
            student_id: Student ID
            
        Returns:
            True if deleted
        """
        result = await notes_collection.delete_one({
            "_id": ObjectId(note_id),
            "student_id": ObjectId(student_id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú")
        
        logger.info(f"🗑️ Note deleted: {note_id}")
        return True
    
    async def get_note_count_by_document(
        self,
        document_id: str,
        student_id: str
    ) -> int:
        """Get note count for a document by a student"""
        return await notes_collection.count_documents({
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id)
        })
    
    async def get_all_notes_by_student(self, student_id: str) -> List[dict]:
        """Get all notes by a student across all documents"""
        cursor = notes_collection.find({
            "student_id": ObjectId(student_id)
        }).sort("updated_at", -1)
        
        notes = []
        async for n in cursor:
            notes.append(self._note_to_response(n))
        
        return notes
    
    # ==================== Private Methods ====================
    
    def _note_to_response(self, note: dict) -> dict:
        """Convert note dict to response format"""
        return {
            "id": str(note["_id"]),
            "document_id": str(note["document_id"]),
            "content": note["content"],
            "position": note["position"],
            "created_at": note["created_at"].isoformat() if note.get("created_at") else None,
            "updated_at": note["updated_at"].isoformat() if note.get("updated_at") else None
        }


# Singleton instance
notes_service = NotesService()
