# Implementation Plan: Realtime Document Sharing with AI-Assisted Learning

## Overview

Triển khai hệ thống chia sẻ tài liệu realtime với highlight, notes, AI explanation, và thống kê điểm danh. Sử dụng TypeScript cho frontend (React Native) và Python cho backend (FastAPI).

## Tasks

- [x] 1. Setup Database Collections và Models
  - [x] 1.1 Tạo MongoDB collections cho documents, highlights, notes, document_views
    - Tạo indexes cho document_id, student_id, class_id
    - _Requirements: 1.1, 4.2, 5.1_
  - [x] 1.2 Tạo Pydantic models cho Document, Highlight, Note, DocumentView
    - Định nghĩa validation rules (note max 1000 chars, highlight colors)
    - _Requirements: 1.5, 5.2, 4.3_

- [x] 2. Implement Document Service (Backend)
  - [x] 2.1 Tạo `backend/document_service.py` với upload_document function
    - Hỗ trợ PDF, DOCX, TXT, MD
    - Extract text content từ file
    - Lưu file vào `/uploads/documents/`
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 2.2 Implement get_documents_by_class và search_documents
    - Pagination (20 per page)
    - Search by title và content
    - _Requirements: 7.1, 7.4, 7.5_
  - [x] 2.3 Implement document view tracking
    - Track view count, unique viewers, reading position
    - _Requirements: 7.3, 8.1, 8.2, 3.4_
  - [ ]* 2.4 Write property test for document storage completeness
    - **Property 1: Document Upload Stores Complete Data**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 3. Implement Highlight Service (Backend)
  - [x] 3.1 Tạo `backend/highlight_service.py` với CRUD operations
    - Create, get, delete highlights
    - Validate color (yellow, green, blue, red)
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 3.2 Implement highlight privacy (student isolation)
    - Filter by student_id in all queries
    - _Requirements: 4.6_
  - [x] 3.3 Implement aggregated highlight statistics for teachers
    - Count highlights per section without student IDs
    - _Requirements: 8.4, 8.5_
  - [ ]* 3.4 Write property test for highlight privacy
    - **Property 4: Highlight Privacy**
    - **Validates: Requirements 4.6**

- [x] 4. Implement Notes Service (Backend)
  - [x] 4.1 Tạo `backend/notes_service.py` với CRUD operations
    - Create, get, update, delete notes
    - Validate content length (max 1000 chars)
    - _Requirements: 5.1, 5.2, 5.5_
  - [x] 4.2 Implement note privacy (student isolation)
    - Filter by student_id in all queries
    - _Requirements: 5.6_
  - [ ]* 4.3 Write property test for note privacy and validation
    - **Property 6: Note Privacy and Validation**
    - **Validates: Requirements 5.2, 5.6**

- [x] 5. Implement AI Service (Backend)
  - [x] 5.1 Tạo `backend/ai_service.py` với OpenAI integration
    - Configure API key từ environment
    - _Requirements: 6.1_
  - [x] 5.2 Implement explain_text với context extraction
    - Extract 500 chars before/after highlighted text
    - Force Vietnamese response
    - _Requirements: 6.2, 6.3_
  - [x] 5.3 Implement follow-up questions và save explanation
    - Store explanations in highlight document
    - _Requirements: 6.5, 6.6_
  - [ ]* 5.4 Write property test for AI context inclusion
    - **Property 7: AI Explanation Context Inclusion**
    - **Validates: Requirements 6.2**

- [x] 6. Implement Attendance Statistics Service (Backend)
  - [x] 6.1 Tạo `backend/attendance_stats_service.py`
    - Session report generation
    - Semester report generation
    - _Requirements: 11.1, 12.1_
  - [x] 6.2 Implement session report với student details
    - Total, present, absent, late counts
    - Flag GPS-invalid và Face ID failures
    - _Requirements: 11.2, 11.3, 11.5_
  - [x] 6.3 Implement semester statistics
    - Attendance rate per student
    - At-risk flagging (< 80%)
    - Class average calculation
    - _Requirements: 12.1, 12.4, 12.5, 12.6_
  - [x] 6.4 Implement student personal stats
    - Personal attendance rate
    - Remaining absences calculation
    - Comparison with class average
    - _Requirements: 13.1, 13.4, 13.5_
  - [x] 6.5 Implement export to CSV/PDF
    - _Requirements: 11.6, 12.8_
  - [ ]* 6.6 Write property test for attendance rate calculation
    - **Property 14: Semester Attendance Rate Calculation**
    - **Validates: Requirements 12.1**
  - [ ]* 6.7 Write property test for at-risk flagging
    - **Property 15: At-Risk Student Flagging**
    - **Validates: Requirements 12.4**

- [x] 7. Implement WebSocket Events (Backend)
  - [x] 7.1 Extend ConnectionManager cho document notifications
    - Add document room management
    - _Requirements: 2.1, 9.1_
  - [x] 7.2 Implement document_shared broadcast
    - Notify all enrolled students
    - Store for offline students
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 7.3 Implement session_report_ready notification
    - Notify teacher when report generated
    - _Requirements: 11.7_
  - [x] 7.4 Implement attendance_warning notification
    - Notify student when rate < 80%
    - _Requirements: 13.3_
  - [ ]* 7.5 Write property test for notification delivery
    - **Property 2: WebSocket Notification Delivery**
    - **Validates: Requirements 2.1, 2.4**

- [x] 8. Checkpoint - Backend Complete
  - Ensure all backend tests pass
  - Test API endpoints với Postman/curl
  - Ask user if questions arise

- [x] 9. Implement Document List Screen (Frontend)
  - [x] 9.1 Tạo `frontend/app/(tabs)/documents.tsx`
    - List documents grouped by class
    - Show status badges (new, viewed, has_highlights)
    - _Requirements: 7.1, 7.2_
  - [x] 9.2 Implement search và filter
    - Search by title/content
    - Filter by class
    - _Requirements: 7.4_
  - [x] 9.3 Implement WebSocket listener cho new documents
    - Show toast notification
    - Auto-refresh list
    - _Requirements: 2.3_

- [x] 10. Implement Document Viewer Screen (Frontend)
  - [x] 10.1 Tạo `frontend/app/(tabs)/document-viewer.tsx`
    - Render document content
    - Support scroll, zoom
    - _Requirements: 3.1, 3.2_
  - [x] 10.2 Implement text selection và highlight creation
    - Show highlight menu on selection
    - Color picker
    - _Requirements: 4.1, 4.3_
  - [x] 10.3 Implement highlight display và interaction
    - Show existing highlights
    - Tap to show options (AI, note, delete)
    - _Requirements: 4.4, 4.5_
  - [x] 10.4 Implement reading position persistence
    - Save position on scroll
    - Restore on return
    - _Requirements: 3.4_

- [x] 11. Implement Notes Components (Frontend)
  - [x] 11.1 Tạo `frontend/components/NoteEditor.tsx`
    - Create/edit note modal
    - Character counter (max 1000)
    - _Requirements: 5.1, 5.2_
  - [x] 11.2 Implement note indicators và popup
    - Show indicators at note positions
    - Tap to view/edit/delete
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 12. Implement AI Explain Modal (Frontend)
  - [x] 12.1 Tạo `frontend/components/AIExplainModal.tsx`
    - Show explanation with loading state
    - _Requirements: 6.1, 6.4_
  - [x] 12.2 Implement follow-up questions
    - Input field for questions
    - Display conversation history
    - _Requirements: 6.5_
  - [x] 12.3 Implement save và fallback
    - Save explanation button
    - Show "ask teacher" suggestion on error
    - _Requirements: 6.6, 6.7_

- [x] 13. Implement Attendance Stats Screen (Frontend)
  - [x] 13.1 Tạo `frontend/app/(tabs)/attendance-stats.tsx` cho Teacher
    - Session report view
    - Semester report với trend chart
    - At-risk students list
    - _Requirements: 11.2, 12.3, 12.4_
  - [x] 13.2 Implement export buttons
    - Export to CSV/PDF
    - _Requirements: 11.6, 12.8_
  - [x] 13.3 Tạo Student attendance stats view
    - Personal attendance rate per class
    - Attendance history
    - Remaining absences warning
    - _Requirements: 13.1, 13.2, 13.4_
  - [x] 13.4 Implement attendance warning listener
    - WebSocket listener for warnings
    - Show alert when rate < 80%
    - _Requirements: 13.3_

- [x] 14. Implement Offline Support (Frontend)
  - [ ] 14.1 Implement document caching với AsyncStorage
    - Cache viewed documents
    - Limit to 50MB
    - _Requirements: 10.1, 10.5_
  - [ ] 14.2 Implement offline queue
    - Queue highlights/notes when offline
    - _Requirements: 10.3_
  - [ ] 14.3 Implement sync on reconnect
    - Sync queued changes
    - Clear queue after sync
    - _Requirements: 10.4_
  - [ ]* 14.4 Write property test for offline sync
    - **Property 18: Offline Queue Sync**
    - **Validates: Requirements 10.3, 10.4**

- [ ] 15. Implement WebSocket Reconnection (Frontend)
  - [ ] 15.1 Implement exponential backoff reconnection
    - 1s, 2s, 4s, 8s, max 30s
    - _Requirements: 9.2_
  - [ ] 15.2 Implement heartbeat
    - Send heartbeat every 30s
    - Reconnect on timeout
    - _Requirements: 9.5_
  - [ ]* 15.3 Write property test for reconnection
    - **Property 20: WebSocket Reconnection**
    - **Validates: Requirements 9.2**

- [ ] 16. Checkpoint - Frontend Complete
  - Ensure all frontend components work
  - Test on iOS và Android
  - Ask user if questions arise

- [ ] 17. Integration Testing
  - [ ] 17.1 Test document upload → notification → view flow
    - _Requirements: 1.1, 2.1, 3.1_
  - [ ] 17.2 Test highlight → AI explain → save flow
    - _Requirements: 4.2, 6.1, 6.6_
  - [ ] 17.3 Test attendance stats generation và display
    - _Requirements: 11.1, 12.1, 13.1_
  - [ ] 17.4 Test offline → online sync flow
    - _Requirements: 10.3, 10.4_

- [ ] 18. Final Checkpoint
  - Ensure all tests pass
  - Review code quality
  - Ask user if questions arise

## Notes

- Tasks marked with `*` are optional property tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
