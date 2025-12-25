"""
AI Service for Realtime Document Sharing
Handles AI-powered explanations for highlighted text using OpenAI API.
"""

import os
import logging
from datetime import datetime
from typing import Optional
import httpx

from database import documents_collection, highlights_collection
from bson import ObjectId
from fastapi import HTTPException

logger = logging.getLogger("ai_service")

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
CONTEXT_CHARS = 500  # Characters before/after highlighted text


class AIService:
    """Service for AI-powered explanations"""
    
    def __init__(self):
        self.api_key = OPENAI_API_KEY
        self.model = OPENAI_MODEL
        self.base_url = "https://api.openai.com/v1/chat/completions"
    
    async def explain_text(
        self,
        highlighted_text: str,
        document_id: str,
        start_position: int,
        language: str = "vi"
    ) -> str:
        """
        Generate AI explanation for highlighted text.
        
        Args:
            highlighted_text: The text to explain
            document_id: Document ID for context
            start_position: Position of highlight in document
            language: Response language (default: Vietnamese)
            
        Returns:
            AI-generated explanation
        """
        # Get document context
        context = await self._get_document_context(document_id, start_position)
        
        # Build prompt
        prompt = self._build_explanation_prompt(highlighted_text, context, language)
        
        # Call AI API
        explanation = await self._call_openai(prompt)
        
        return explanation
    
    async def ask_followup(
        self,
        highlight_id: str,
        question: str,
        student_id: str
    ) -> str:
        """
        Answer a follow-up question about a highlight.
        
        Args:
            highlight_id: Highlight ID
            question: Follow-up question
            student_id: Student ID for privacy check
            
        Returns:
            AI-generated answer
        """
        # Get highlight with existing explanation
        highlight = await highlights_collection.find_one({
            "_id": ObjectId(highlight_id),
            "student_id": ObjectId(student_id)
        })
        
        if not highlight:
            raise HTTPException(status_code=404, detail="Không tìm thấy highlight")
        
        # Build follow-up prompt
        prompt = self._build_followup_prompt(
            highlighted_text=highlight["text_content"],
            previous_explanation=highlight.get("ai_explanation", {}).get("content", ""),
            question=question
        )
        
        # Call AI API
        answer = await self._call_openai(prompt)
        
        return answer
    
    async def _get_document_context(
        self,
        document_id: str,
        position: int
    ) -> str:
        """Get surrounding context from document"""
        doc = await documents_collection.find_one({"_id": ObjectId(document_id)})
        
        if not doc or not doc.get("text_content"):
            return ""
        
        text = doc["text_content"]
        
        # Get context before and after
        start = max(0, position - CONTEXT_CHARS)
        end = min(len(text), position + CONTEXT_CHARS)
        
        context = text[start:end]
        
        # Add markers
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        
        return context
    
    def _build_explanation_prompt(
        self,
        highlighted_text: str,
        context: str,
        language: str
    ) -> str:
        """Build prompt for explanation"""
        lang_instruction = "Trả lời bằng tiếng Việt." if language == "vi" else f"Respond in {language}."
        
        prompt = f"""Bạn là một trợ lý học tập thông minh. Sinh viên đã bôi đen đoạn văn bản sau vì không hiểu:

**Đoạn được bôi đen:**
"{highlighted_text}"

**Ngữ cảnh xung quanh:**
{context}

**Yêu cầu:**
1. Giải thích đoạn văn bản được bôi đen một cách dễ hiểu
2. Nếu có thuật ngữ chuyên môn, hãy định nghĩa chúng
3. Đưa ra ví dụ minh họa nếu phù hợp
4. Giữ giải thích ngắn gọn, súc tích (tối đa 300 từ)

{lang_instruction}"""
        
        return prompt
    
    def _build_followup_prompt(
        self,
        highlighted_text: str,
        previous_explanation: str,
        question: str
    ) -> str:
        """Build prompt for follow-up question"""
        prompt = f"""Bạn là một trợ lý học tập thông minh. Sinh viên đang hỏi thêm về một đoạn văn bản.

**Đoạn văn bản gốc:**
"{highlighted_text}"

**Giải thích trước đó:**
{previous_explanation}

**Câu hỏi của sinh viên:**
{question}

**Yêu cầu:**
1. Trả lời câu hỏi một cách rõ ràng, dễ hiểu
2. Liên hệ với đoạn văn bản gốc nếu cần
3. Giữ câu trả lời ngắn gọn (tối đa 200 từ)

Trả lời bằng tiếng Việt."""
        
        return prompt
    
    async def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API"""
        if not self.api_key:
            # Fallback response when no API key
            logger.warning("⚠️ OpenAI API key not configured, using fallback response")
            return self._get_fallback_response()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "Bạn là một trợ lý học tập thông minh, giúp sinh viên hiểu bài học."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 500,
                        "temperature": 0.7
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                
                elif response.status_code == 429:
                    logger.warning("⚠️ OpenAI rate limit exceeded")
                    raise HTTPException(
                        status_code=429,
                        detail="Vui lòng thử lại sau ít phút"
                    )
                
                else:
                    logger.error(f"❌ OpenAI API error: {response.status_code}")
                    return self._get_fallback_response()
                    
        except httpx.TimeoutException:
            logger.error("❌ OpenAI API timeout")
            raise HTTPException(
                status_code=503,
                detail="Dịch vụ AI tạm thời không khả dụng"
            )
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {e}")
            return self._get_fallback_response()
    
    def _get_fallback_response(self) -> str:
        """Get fallback response when AI is unavailable"""
        return """Xin lỗi, tôi không thể tạo giải thích tự động lúc này. 

**Gợi ý:**
- Hãy thử đọc lại đoạn văn bản trong ngữ cảnh rộng hơn
- Tra cứu các thuật ngữ chuyên môn trên Google hoặc Wikipedia
- Hỏi giáo viên hoặc bạn bè để được giải thích trực tiếp

Nếu bạn cần hỗ trợ thêm, hãy liên hệ giáo viên của lớp."""


# Singleton instance
ai_service = AIService()
