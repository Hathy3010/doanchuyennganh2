"""
Highlight Service for Realtime Document Sharing
Handles student highlights on documents with privacy isolation.
"""

import logging
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException

from database import highlights_collection, documents_collection

logger = logging.getLogger("highlight_service")

# Valid highlight colors
VALID_COLORS = {"yellow", "green", "blue", "red"}


class HighlightService:
    """Service for managing document highlights"""
    
    async def create_highlight(
        self,
        document_id: str,
        student_id: str,
        text_content: str,
        start_position: int,
        end_position: int,
        color: str = "yellow"
    ) -> dict:
        """
        Create a new highlight.
        
        Args:
            document_id: Document ID
            student_id: Student ID (owner)
            text_content: Highlighted text
            start_position: Start character position
            end_position: End character position
            color: Highlight color (yellow, green, blue, red)
            
        Returns:
            Created highlight dict
        """
        # Validate color
        if color not in VALID_COLORS:
            raise HTTPException(
                status_code=400,
                detail=f"Màu không hợp lệ. Chỉ hỗ trợ: {', '.join(VALID_COLORS)}"
            )
        
        # Validate document exists
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        # Validate positions
        if start_position < 0 or end_position <= start_position:
            raise HTTPException(status_code=400, detail="Vị trí không hợp lệ")
        
        # Create highlight
        highlight = {
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id),
            "text_content": text_content,
            "start_position": start_position,
            "end_position": end_position,
            "color": color,
            "ai_explanation": None,
            "created_at": datetime.utcnow()
        }
        
        result = await highlights_collection.insert_one(highlight)
        highlight["_id"] = result.inserted_id
        
        logger.info(f"🖍️ Highlight created: {result.inserted_id} by student {student_id}")
        
        return self._highlight_to_response(highlight)
    
    async def get_highlights_by_student(
        self,
        document_id: str,
        student_id: str
    ) -> List[dict]:
        """
        Get all highlights for a document by a specific student.
        Privacy: Only returns highlights owned by the student.
        
        Args:
            document_id: Document ID
            student_id: Student ID
            
        Returns:
            List of highlights
        """
        cursor = highlights_collection.find({
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id)
        }).sort("start_position", 1)
        
        highlights = []
        async for h in cursor:
            highlights.append(self._highlight_to_response(h))
        
        return highlights
    
    async def get_highlight(self, highlight_id: str, student_id: str) -> dict:
        """
        Get a single highlight by ID.
        Privacy: Only returns if owned by the student.
        
        Args:
            highlight_id: Highlight ID
            student_id: Student ID
            
        Returns:
            Highlight dict
        """
        highlight = await highlights_collection.find_one({
            "_id": ObjectId(highlight_id),
            "student_id": ObjectId(student_id)
        })
        
        if not highlight:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        return self._highlight_to_response(highlight)
    
    async def update_highlight_color(
        self,
        highlight_id: str,
        student_id: str,
        color: str
    ) -> dict:
        """Update highlight color"""
        if color not in VALID_COLORS:
            raise HTTPException(
                status_code=400,
                detail=f"Màu không hợp lệ. Chỉ hỗ trợ: {', '.join(VALID_COLORS)}"
            )
        
        result = await highlights_collection.update_one(
            {
                "_id": ObjectId(highlight_id),
                "student_id": ObjectId(student_id)
            },
            {"$set": {"color": color}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        return await self.get_highlight(highlight_id, student_id)
    
    async def delete_highlight(self, highlight_id: str, student_id: str) -> bool:
        """
        Delete a highlight.
        Privacy: Only deletes if owned by the student.
        
        Args:
            highlight_id: Highlight ID
            student_id: Student ID
            
        Returns:
            True if deleted
        """
        result = await highlights_collection.delete_one({
            "_id": ObjectId(highlight_id),
            "student_id": ObjectId(student_id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        logger.info(f"🗑️ Highlight deleted: {highlight_id}")
        return True
    
    async def save_ai_explanation(
        self,
        highlight_id: str,
        student_id: str,
        explanation: str
    ) -> dict:
        """Save AI explanation for a highlight"""
        ai_explanation = {
            "content": explanation,
            "generated_at": datetime.utcnow().isoformat(),
            "followup_questions": []
        }
        
        result = await highlights_collection.update_one(
            {
                "_id": ObjectId(highlight_id),
                "student_id": ObjectId(student_id)
            },
            {"$set": {"ai_explanation": ai_explanation}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        return await self.get_highlight(highlight_id, student_id)
    
    async def add_followup_question(
        self,
        highlight_id: str,
        student_id: str,
        question: str,
        answer: str
    ) -> dict:
        """Add a follow-up question and answer to highlight"""
        followup = {
            "question": question,
            "answer": answer,
            "asked_at": datetime.utcnow().isoformat()
        }
        
        result = await highlights_collection.update_one(
            {
                "_id": ObjectId(highlight_id),
                "student_id": ObjectId(student_id)
            },
            {"$push": {"ai_explanation.followup_questions": followup}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        return await self.get_highlight(highlight_id, student_id)
    
    async def get_aggregated_highlights(self, document_id: str) -> List[dict]:
        """
        Get aggregated highlight statistics for a document (teacher view).
        Privacy: Returns only aggregated data, no student identifiers.
        
        Args:
            document_id: Document ID
            
        Returns:
            List of sections with highlight counts
        """
        # Aggregate highlights by position ranges (sections)
        pipeline = [
            {"$match": {"document_id": ObjectId(document_id)}},
            {
                "$group": {
                    "_id": {
                        # Group by 500-character sections
                        "section": {"$floor": {"$divide": ["$start_position", 500]}}
                    },
                    "highlight_count": {"$sum": 1},
                    "unique_students": {"$addToSet": "$student_id"},
                    "sample_text": {"$first": "$text_content"}
                }
            },
            {
                "$project": {
                    "section_start": {"$multiply": ["$_id.section", 500]},
                    "section_end": {"$add": [{"$multiply": ["$_id.section", 500]}, 500]},
                    "highlight_count": 1,
                    "unique_student_count": {"$size": "$unique_students"},
                    "sample_text": {"$substr": ["$sample_text", 0, 100]}
                }
            },
            {"$sort": {"highlight_count": -1}}
        ]
        
        results = await highlights_collection.aggregate(pipeline).to_list(100)
        
        # Format response without student IDs
        return [
            {
                "section_start": r["section_start"],
                "section_end": r["section_end"],
                "highlight_count": r["highlight_count"],
                "unique_student_count": r["unique_student_count"],
                "sample_text": r["sample_text"],
                "difficulty_indicator": "high" if r["unique_student_count"] >= 5 else "medium" if r["unique_student_count"] >= 2 else "low"
            }
            for r in results
        ]
    
    async def get_highlight_count_by_document(self, document_id: str) -> int:
        """Get total highlight count for a document"""
        return await highlights_collection.count_documents({
            "document_id": ObjectId(document_id)
        })
    
    # ==================== Private Methods ====================
    
    def _highlight_to_response(self, highlight: dict) -> dict:
        """Convert highlight dict to response format"""
        return {
            "id": str(highlight["_id"]),
            "document_id": str(highlight["document_id"]),
            "text_content": highlight["text_content"],
            "start_position": highlight["start_position"],
            "end_position": highlight["end_position"],
            "color": highlight["color"],
            "ai_explanation": highlight.get("ai_explanation"),
            "created_at": highlight["created_at"].isoformat() if highlight.get("created_at") else None
        }


# Singleton instance
highlight_service = HighlightService()
