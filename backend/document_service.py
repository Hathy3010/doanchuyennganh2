"""
Document Service for Realtime Document Sharing
Handles document upload, storage, text extraction, and retrieval.
"""

import os
import logging
from datetime import datetime
from typing import List, Optional, Tuple
from bson import ObjectId
from fastapi import UploadFile, HTTPException

# Text extraction libraries
import PyPDF2
from docx import Document as DocxDocument

from database import (
    documents_collection, document_views_collection, highlights_collection,
    DocumentShare, DocumentShareResponse, DocumentView
)

logger = logging.getLogger("document_service")

# Configuration
UPLOAD_DIR = "uploads/documents"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}


class DocumentService:
    """Service for managing shared documents"""
    
    def __init__(self):
        # Ensure upload directory exists
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    async def upload_document(
        self,
        file: UploadFile,
        class_id: str,
        teacher_id: str,
        title: str,
        description: Optional[str] = None
    ) -> dict:
        """
        Upload a document and extract text content.
        
        Args:
            file: Uploaded file
            class_id: Class ID to associate document with
            teacher_id: Teacher who uploaded
            title: Document title
            description: Optional description
            
        Returns:
            Created document dict
        """
        # Validate file extension
        file_ext = self._get_file_extension(file.filename)
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Định dạng file không hỗ trợ. Chỉ hỗ trợ: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File quá lớn. Tối đa {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Create directory structure
        class_dir = os.path.join(UPLOAD_DIR, class_id)
        os.makedirs(class_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(class_dir, safe_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        logger.info(f"📁 File saved: {file_path}")
        
        # Extract text content
        text_content = await self._extract_text(file_path, file_ext, content)
        
        # Create document record
        doc = {
            "class_id": ObjectId(class_id),
            "teacher_id": ObjectId(teacher_id),
            "title": title,
            "description": description,
            "file_path": file_path,
            "file_type": file_ext,
            "file_size": file_size,
            "text_content": text_content,
            "upload_time": datetime.utcnow(),
            "view_count": 0,
            "unique_viewers": [],
            "is_shared": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await documents_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        
        logger.info(f"📄 Document created: {result.inserted_id}")
        
        return self._doc_to_response(doc)
    
    async def share_document(self, document_id: str, teacher_id: str) -> dict:
        """Mark document as shared and return it"""
        doc = await documents_collection.find_one({
            "_id": ObjectId(document_id),
            "teacher_id": ObjectId(teacher_id)
        })
        
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        await documents_collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {"is_shared": True, "updated_at": datetime.utcnow()}}
        )
        
        doc["is_shared"] = True
        return self._doc_to_response(doc)

    
    async def get_documents_by_class(
        self,
        class_id: str,
        student_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[dict], int]:
        """
        Get documents for a class with pagination.
        
        Args:
            class_id: Class ID
            student_id: Optional student ID to include view status
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Tuple of (documents list, total count)
        """
        query = {"class_id": ObjectId(class_id), "is_shared": True}
        
        # Get total count
        total = await documents_collection.count_documents(query)
        
        # Get paginated documents
        skip = (page - 1) * page_size
        cursor = documents_collection.find(query).sort("upload_time", -1).skip(skip).limit(page_size)
        
        documents = []
        async for doc in cursor:
            doc_response = self._doc_to_response(doc)
            
            # Add student-specific status if student_id provided
            if student_id:
                doc_response["status"] = await self._get_document_status(
                    str(doc["_id"]), student_id
                )
            
            documents.append(doc_response)
        
        return documents, total
    
    async def get_document(self, document_id: str) -> dict:
        """Get a single document by ID"""
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        return self._doc_to_response(doc)
    
    async def get_document_content(self, document_id: str) -> str:
        """Get extracted text content of a document"""
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        return doc.get("text_content", "")
    
    async def search_documents(
        self,
        class_id: str,
        query: str,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[dict], int]:
        """
        Search documents by title or content.
        
        Args:
            class_id: Class ID
            query: Search query
            page: Page number
            page_size: Items per page
            
        Returns:
            Tuple of (documents list, total count)
        """
        search_query = {
            "class_id": ObjectId(class_id),
            "is_shared": True,
            "$or": [
                {"title": {"$regex": query, "$options": "i"}},
                {"text_content": {"$regex": query, "$options": "i"}}
            ]
        }
        
        total = await documents_collection.count_documents(search_query)
        
        skip = (page - 1) * page_size
        cursor = documents_collection.find(search_query).sort("upload_time", -1).skip(skip).limit(page_size)
        
        documents = []
        async for doc in cursor:
            documents.append(self._doc_to_response(doc))
        
        return documents, total
    
    async def delete_document(self, document_id: str, teacher_id: str) -> bool:
        """Delete a document (teacher only)"""
        doc = await documents_collection.find_one({
            "_id": ObjectId(document_id),
            "teacher_id": ObjectId(teacher_id)
        })
        
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        # Delete file
        if os.path.exists(doc["file_path"]):
            os.remove(doc["file_path"])
        
        # Delete document record
        await documents_collection.delete_one({"_id": ObjectId(document_id)})
        
        # Delete related highlights and notes
        await highlights_collection.delete_many({"document_id": ObjectId(document_id)})
        await document_views_collection.delete_many({"document_id": ObjectId(document_id)})
        
        logger.info(f"🗑️ Document deleted: {document_id}")
        return True
    
    async def record_view(
        self,
        document_id: str,
        student_id: str,
        reading_position: int = 0,
        time_spent: int = 0
    ) -> dict:
        """
        Record or update document view.
        
        Args:
            document_id: Document ID
            student_id: Student ID
            reading_position: Current reading position
            time_spent: Additional time spent (seconds)
            
        Returns:
            Updated view record
        """
        doc_oid = ObjectId(document_id)
        student_oid = ObjectId(student_id)
        
        # Check if view exists
        existing = await document_views_collection.find_one({
            "document_id": doc_oid,
            "student_id": student_oid
        })
        
        if existing:
            # Update existing view
            await document_views_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "last_viewed_at": datetime.utcnow(),
                        "reading_position": reading_position
                    },
                    "$inc": {
                        "view_count": 1,
                        "time_spent_seconds": time_spent
                    }
                }
            )
        else:
            # Create new view
            view = {
                "document_id": doc_oid,
                "student_id": student_oid,
                "first_viewed_at": datetime.utcnow(),
                "last_viewed_at": datetime.utcnow(),
                "reading_position": reading_position,
                "time_spent_seconds": time_spent,
                "view_count": 1
            }
            await document_views_collection.insert_one(view)
            
            # Add to unique viewers
            await documents_collection.update_one(
                {"_id": doc_oid},
                {
                    "$addToSet": {"unique_viewers": student_oid},
                    "$inc": {"view_count": 1}
                }
            )
        
        # Get updated view
        view = await document_views_collection.find_one({
            "document_id": doc_oid,
            "student_id": student_oid
        })
        
        return {
            "document_id": document_id,
            "reading_position": view["reading_position"],
            "view_count": view["view_count"],
            "time_spent_seconds": view["time_spent_seconds"]
        }
    
    async def get_reading_position(self, document_id: str, student_id: str) -> int:
        """Get saved reading position for a student"""
        view = await document_views_collection.find_one({
            "document_id": ObjectId(document_id),
            "student_id": ObjectId(student_id)
        })
        
        return view["reading_position"] if view else 0
    
    async def get_document_analytics(self, document_id: str) -> dict:
        """Get analytics for a document (teacher view)"""
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
        # Get view statistics
        pipeline = [
            {"$match": {"document_id": ObjectId(document_id)}},
            {"$group": {
                "_id": None,
                "total_views": {"$sum": "$view_count"},
                "unique_viewers": {"$sum": 1},
                "avg_time_spent": {"$avg": "$time_spent_seconds"}
            }}
        ]
        
        stats = await document_views_collection.aggregate(pipeline).to_list(1)
        
        if stats:
            return {
                "document_id": document_id,
                "total_views": stats[0]["total_views"],
                "unique_viewers": stats[0]["unique_viewers"],
                "avg_time_spent_seconds": round(stats[0]["avg_time_spent"] or 0, 2)
            }
        
        return {
            "document_id": document_id,
            "total_views": 0,
            "unique_viewers": 0,
            "avg_time_spent_seconds": 0
        }
    
    # ==================== Private Methods ====================
    
    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension from filename"""
        if not filename or "." not in filename:
            return ""
        return filename.rsplit(".", 1)[1].lower()
    
    async def _extract_text(self, file_path: str, file_ext: str, content: bytes) -> Optional[str]:
        """Extract text content from file"""
        try:
            if file_ext == "txt" or file_ext == "md":
                return content.decode("utf-8", errors="ignore")
            
            elif file_ext == "pdf":
                return self._extract_pdf_text(file_path)
            
            elif file_ext == "docx":
                return self._extract_docx_text(file_path)
            
        except Exception as e:
            logger.warning(f"⚠️ Text extraction failed for {file_path}: {e}")
            return None
        
        return None
    
    def _extract_pdf_text(self, file_path: str) -> str:
        """Extract text from PDF file"""
        text_parts = []
        
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        
        return "\n".join(text_parts)
    
    def _extract_docx_text(self, file_path: str) -> str:
        """Extract text from DOCX file"""
        doc = DocxDocument(file_path)
        text_parts = []
        
        for para in doc.paragraphs:
            if para.text:
                text_parts.append(para.text)
        
        return "\n".join(text_parts)
    
    async def _get_document_status(self, document_id: str, student_id: str) -> dict:
        """Get document status for a student"""
        doc_oid = ObjectId(document_id)
        student_oid = ObjectId(student_id)
        
        # Check if viewed
        view = await document_views_collection.find_one({
            "document_id": doc_oid,
            "student_id": student_oid
        })
        
        # Check if has highlights
        highlight_count = await highlights_collection.count_documents({
            "document_id": doc_oid,
            "student_id": student_oid
        })
        
        # Check if has notes
        from database import notes_collection
        note_count = await notes_collection.count_documents({
            "document_id": doc_oid,
            "student_id": student_oid
        })
        
        return {
            "viewed": view is not None,
            "has_highlights": highlight_count > 0,
            "has_notes": note_count > 0,
            "is_new": view is None
        }
    
    def _doc_to_response(self, doc: dict) -> dict:
        """Convert document dict to response format"""
        return {
            "id": str(doc["_id"]),
            "class_id": str(doc["class_id"]),
            "teacher_id": str(doc["teacher_id"]),
            "title": doc["title"],
            "description": doc.get("description"),
            "file_type": doc["file_type"],
            "file_size": doc["file_size"],
            "upload_time": doc["upload_time"].isoformat() if doc.get("upload_time") else None,
            "view_count": doc.get("view_count", 0),
            "unique_viewers_count": len(doc.get("unique_viewers", [])),
            "is_shared": doc.get("is_shared", False)
        }


# Singleton instance
document_service = DocumentService()
