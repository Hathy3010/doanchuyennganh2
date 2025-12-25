# Design Document: Realtime Document Sharing with AI-Assisted Learning

## Overview

Hệ thống chia sẻ tài liệu realtime giữa giáo viên và sinh viên, tích hợp với hệ thống điểm danh hiện có. Sử dụng WebSocket cho realtime updates, MongoDB cho storage, và AI (OpenAI/local LLM) cho giải thích nội dung.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React Native)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ DocumentList │  │DocumentViewer│  │ AttendanceStats      │  │
│  │  Component   │  │  Component   │  │    Component         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Highlight   │  │    Notes     │  │    AI Explain        │  │
│  │  Manager     │  │   Manager    │  │    Component         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                           │                                      │
│                    WebSocket Client                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   WebSocket   │
                    │    Server     │
                    └───────┬───────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                     Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Document    │  │  Highlight   │  │   Attendance         │  │
│  │   Service    │  │   Service    │  │   Statistics         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Notes     │  │     AI       │  │   WebSocket          │  │
│  │   Service    │  │   Service    │  │   Manager            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │  MongoDB  │ │   File    │ │  OpenAI   │
        │           │ │  Storage  │ │    API    │
        └───────────┘ └───────────┘ └───────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Document Service (`backend/document_service.py`)

```python
class DocumentService:
    async def upload_document(
        self, 
        file: UploadFile, 
        class_id: str, 
        teacher_id: str,
        title: str,
        description: str
    ) -> Document
    
    async def get_documents_by_class(self, class_id: str) -> List[Document]
    
    async def get_document(self, document_id: str) -> Document
    
    async def extract_text_content(self, document_id: str) -> str
    
    async def search_documents(
        self, 
        class_id: str, 
        query: str
    ) -> List[Document]
    
    async def delete_document(self, document_id: str, teacher_id: str) -> bool
```

#### 2. Highlight Service (`backend/highlight_service.py`)

```python
class HighlightService:
    async def create_highlight(
        self,
        document_id: str,
        student_id: str,
        text_content: str,
        start_position: int,
        end_position: int,
        color: str  # yellow, green, blue, red
    ) -> Highlight
    
    async def get_highlights_by_student(
        self, 
        document_id: str, 
        student_id: str
    ) -> List[Highlight]
    
    async def delete_highlight(
        self, 
        highlight_id: str, 
        student_id: str
    ) -> bool
    
    async def get_aggregated_highlights(
        self, 
        document_id: str
    ) -> List[HighlightAggregate]  # For teacher analytics
```

#### 3. Notes Service (`backend/notes_service.py`)

```python
class NotesService:
    async def create_note(
        self,
        document_id: str,
        student_id: str,
        content: str,  # max 1000 chars
        position: int
    ) -> Note
    
    async def get_notes_by_student(
        self, 
        document_id: str, 
        student_id: str
    ) -> List[Note]
    
    async def update_note(
        self, 
        note_id: str, 
        student_id: str, 
        content: str
    ) -> Note
    
    async def delete_note(self, note_id: str, student_id: str) -> bool
```

#### 4. AI Service (`backend/ai_service.py`)

```python
class AIService:
    async def explain_text(
        self,
        highlighted_text: str,
        document_context: str,  # surrounding paragraphs
        language: str = "vi"
    ) -> AIExplanation
    
    async def ask_followup(
        self,
        explanation_id: str,
        question: str
    ) -> AIExplanation
    
    async def save_explanation(
        self,
        highlight_id: str,
        explanation: AIExplanation
    ) -> bool
```

#### 5. Attendance Statistics Service (`backend/attendance_stats_service.py`)

```python
class AttendanceStatsService:
    # Session Statistics
    async def get_session_report(
        self, 
        class_id: str, 
        date: str
    ) -> SessionReport
    
    async def generate_session_report(
        self, 
        class_id: str, 
        date: str
    ) -> SessionReport
    
    # Semester Statistics
    async def get_semester_report(
        self,
        class_id: str,
        start_date: str,
        end_date: str
    ) -> SemesterReport
    
    async def get_student_attendance_rate(
        self,
        student_id: str,
        class_id: str
    ) -> float
    
    async def get_at_risk_students(
        self, 
        class_id: str, 
        threshold: float = 0.8
    ) -> List[AtRiskStudent]
    
    async def get_class_average_attendance(
        self, 
        class_id: str
    ) -> float
    
    # Student Personal Stats
    async def get_student_stats(
        self,
        student_id: str,
        class_id: str
    ) -> StudentAttendanceStats
    
    async def get_remaining_absences(
        self,
        student_id: str,
        class_id: str,
        max_absences: int = 3
    ) -> int
    
    # Export
    async def export_to_csv(
        self, 
        report: Union[SessionReport, SemesterReport]
    ) -> bytes
    
    async def export_to_pdf(
        self, 
        report: Union[SessionReport, SemesterReport]
    ) -> bytes
```

### Frontend Components

#### 1. DocumentListScreen (`frontend/app/(tabs)/documents.tsx`)

```typescript
interface DocumentListScreenProps {
  classId?: string;
}

// Features:
// - List documents grouped by class
// - Show document status (new, viewed, has_highlights, has_notes)
// - Search by title/content
// - Pull to refresh
// - Realtime updates via WebSocket
```

#### 2. DocumentViewerScreen (`frontend/app/(tabs)/document-viewer.tsx`)

```typescript
interface DocumentViewerProps {
  documentId: string;
}

// Features:
// - Render document content (PDF, text)
// - Text selection for highlighting
// - Display existing highlights
// - Display note indicators
// - Zoom and scroll
// - Save reading position
```

#### 3. HighlightManager (`frontend/components/HighlightManager.tsx`)

```typescript
interface HighlightManagerProps {
  documentId: string;
  selectedText: string;
  position: { start: number; end: number };
  onHighlightCreated: (highlight: Highlight) => void;
}

// Features:
// - Color picker (yellow, green, blue, red)
// - Create highlight
// - Show highlight options (AI explain, add note, delete)
```

#### 4. AIExplainModal (`frontend/components/AIExplainModal.tsx`)

```typescript
interface AIExplainModalProps {
  highlightId: string;
  highlightedText: string;
  onClose: () => void;
}

// Features:
// - Show AI explanation
// - Loading state
// - Follow-up questions
// - Save explanation
```

#### 5. AttendanceStatsScreen (`frontend/app/(tabs)/attendance-stats.tsx`)

```typescript
// For Teachers:
interface TeacherStatsProps {
  classId: string;
}

// Features:
// - Session report (after each class)
// - Semester report with trend chart
// - At-risk students list
// - Export to CSV/PDF

// For Students:
interface StudentStatsProps {
  studentId: string;
}

// Features:
// - Personal attendance rate per class
// - Attendance history
// - Remaining absences warning
// - Comparison with class average
```

## Data Models

### Document Collection

```javascript
{
  _id: ObjectId,
  class_id: ObjectId,
  teacher_id: ObjectId,
  title: String,
  description: String,
  file_path: String,           // Path to stored file
  file_type: String,           // pdf, docx, txt, md
  file_size: Number,           // bytes
  text_content: String,        // Extracted text for search/AI
  upload_time: DateTime,
  view_count: Number,
  unique_viewers: [ObjectId],  // Array of student IDs
  created_at: DateTime,
  updated_at: DateTime
}
```

### Highlight Collection

```javascript
{
  _id: ObjectId,
  document_id: ObjectId,
  student_id: ObjectId,        // Private to student
  text_content: String,
  start_position: Number,
  end_position: Number,
  color: String,               // yellow, green, blue, red
  ai_explanation: {
    content: String,
    generated_at: DateTime,
    followup_questions: [{
      question: String,
      answer: String,
      asked_at: DateTime
    }]
  },
  created_at: DateTime
}
```

### Note Collection

```javascript
{
  _id: ObjectId,
  document_id: ObjectId,
  student_id: ObjectId,        // Private to student
  content: String,             // max 1000 chars
  position: Number,
  created_at: DateTime,
  updated_at: DateTime
}
```

### Document View Collection

```javascript
{
  _id: ObjectId,
  document_id: ObjectId,
  student_id: ObjectId,
  first_viewed_at: DateTime,
  last_viewed_at: DateTime,
  reading_position: Number,    // For resume reading
  time_spent_seconds: Number,
  view_count: Number
}
```

### Session Attendance Report (Generated)

```javascript
{
  _id: ObjectId,
  class_id: ObjectId,
  date: String,                // YYYY-MM-DD
  total_students: Number,
  present_count: Number,
  absent_count: Number,
  late_count: Number,
  attendance_rate: Number,     // percentage
  students: [{
    student_id: ObjectId,
    student_name: String,
    status: String,            // present, absent, late, excused
    check_in_time: DateTime,
    gps_status: String,
    face_id_status: String,
    warnings: [String]
  }],
  generated_at: DateTime
}
```

### Offline Queue Collection (Local Storage)

```javascript
{
  id: String,                  // UUID
  type: String,                // highlight, note, view
  action: String,              // create, update, delete
  data: Object,
  created_at: DateTime,
  synced: Boolean
}
```

## WebSocket Events

### Server → Client Events

```typescript
// New document shared
{
  type: "document_shared",
  document_id: string,
  title: string,
  teacher_name: string,
  class_name: string,
  timestamp: string
}

// Session report generated
{
  type: "session_report_ready",
  class_id: string,
  date: string,
  attendance_rate: number,
  timestamp: string
}

// At-risk warning (for student)
{
  type: "attendance_warning",
  class_id: string,
  class_name: string,
  attendance_rate: number,
  remaining_absences: number,
  message: string
}
```

### Client → Server Events

```typescript
// Join document room (for realtime updates)
{
  type: "join_document",
  document_id: string
}

// Leave document room
{
  type: "leave_document",
  document_id: string
}

// Heartbeat
{
  type: "heartbeat",
  timestamp: string
}
```

## API Endpoints

### Document Endpoints

```
POST   /documents/upload          - Upload document
GET    /documents/class/{id}      - Get documents by class
GET    /documents/{id}            - Get document details
GET    /documents/{id}/content    - Get document content (text)
DELETE /documents/{id}            - Delete document
GET    /documents/search          - Search documents
```

### Highlight Endpoints

```
POST   /highlights                - Create highlight
GET    /highlights/document/{id}  - Get highlights for document
DELETE /highlights/{id}           - Delete highlight
POST   /highlights/{id}/explain   - Get AI explanation
POST   /highlights/{id}/followup  - Ask follow-up question
```

### Notes Endpoints

```
POST   /notes                     - Create note
GET    /notes/document/{id}       - Get notes for document
PUT    /notes/{id}                - Update note
DELETE /notes/{id}                - Delete note
```

### Attendance Statistics Endpoints

```
GET    /stats/session/{class_id}/{date}     - Get session report
POST   /stats/session/{class_id}/{date}     - Generate session report
GET    /stats/semester/{class_id}           - Get semester report
GET    /stats/student/{student_id}/{class_id} - Get student stats
GET    /stats/at-risk/{class_id}            - Get at-risk students
GET    /stats/export/csv                    - Export to CSV
GET    /stats/export/pdf                    - Export to PDF
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document Upload Stores Complete Data

*For any* valid document upload request, the stored document SHALL contain all required fields: class_id, teacher_id, title, file_path, file_type, file_size, text_content, and upload_time.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: WebSocket Notification Delivery

*For any* document share event, all online students enrolled in the class SHALL receive a notification containing document_id, title, teacher_name, class_name, and timestamp.

**Validates: Requirements 2.1, 2.4**

### Property 3: Offline Notification Queuing

*For any* document share event, if a student is offline, the notification SHALL be stored and delivered when the student comes online.

**Validates: Requirements 2.2**

### Property 4: Highlight Privacy

*For any* highlight created by student A, student B (where A ≠ B) SHALL NOT be able to retrieve that highlight, even for the same document.

**Validates: Requirements 4.6**

### Property 5: Highlight CRUD Completeness

*For any* highlight creation, the stored highlight SHALL contain document_id, student_id, text_content, start_position, end_position, color, and timestamp.

**Validates: Requirements 4.2**

### Property 6: Note Privacy and Validation

*For any* note created by student A, student B SHALL NOT be able to retrieve, update, or delete that note. Additionally, note content SHALL be limited to 1000 characters.

**Validates: Requirements 5.2, 5.6**

### Property 7: AI Explanation Context Inclusion

*For any* AI explanation request, the request to the AI service SHALL include both the highlighted text AND surrounding document context (at least 500 characters before and after).

**Validates: Requirements 6.2**

### Property 8: AI Explanation Language

*For any* AI explanation response, the explanation content SHALL be in Vietnamese.

**Validates: Requirements 6.3**

### Property 9: Document Search Accuracy

*For any* search query, all returned documents SHALL contain the query string in either title OR text_content.

**Validates: Requirements 7.4**

### Property 10: Document View Tracking

*For any* document view by a student, the view SHALL be recorded and the student SHALL be added to unique_viewers if not already present.

**Validates: Requirements 7.3, 8.1**

### Property 11: Aggregated Highlight Statistics Privacy

*For any* teacher request for highlight statistics, the response SHALL contain aggregated data (section, count) but SHALL NOT contain individual student identifiers.

**Validates: Requirements 8.4, 8.5**

### Property 12: Session Report Completeness

*For any* session report, the report SHALL contain: total_students, present_count, absent_count, late_count, attendance_rate, and a list of all students with their status.

**Validates: Requirements 11.2, 11.3**

### Property 13: Session Report Flagging

*For any* session report, students with GPS-invalid attempts OR Face ID failures SHALL be flagged in the report.

**Validates: Requirements 11.5**

### Property 14: Semester Attendance Rate Calculation

*For any* student in a class, the semester attendance rate SHALL equal (attended_sessions / total_sessions) * 100, rounded to 2 decimal places.

**Validates: Requirements 12.1**

### Property 15: At-Risk Student Flagging

*For any* student with attendance rate below 80%, the student SHALL be flagged as "at-risk" in the semester report.

**Validates: Requirements 12.4**

### Property 16: Student Attendance Rate Retrieval

*For any* student viewing their attendance stats, the response SHALL include: attendance_rate, attended_sessions, missed_sessions, and remaining_allowed_absences.

**Validates: Requirements 13.1, 13.4**

### Property 17: Attendance Warning Trigger

*For any* student whose attendance rate drops below 80%, a warning notification SHALL be sent via WebSocket.

**Validates: Requirements 13.3**

### Property 18: Offline Queue Sync

*For any* offline action (highlight, note, view), when connection is restored, the queued action SHALL be synced to the server and the local queue SHALL be cleared.

**Validates: Requirements 10.3, 10.4**

### Property 19: Reading Position Persistence

*For any* document view, the reading position SHALL be saved. When the student returns to the document, the saved position SHALL be restored.

**Validates: Requirements 3.4**

### Property 20: WebSocket Reconnection

*For any* WebSocket disconnection, the client SHALL attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s).

**Validates: Requirements 9.2**

## Error Handling

### Document Upload Errors

| Error | HTTP Code | Message | Action |
|-------|-----------|---------|--------|
| Invalid file type | 400 | "Định dạng file không hỗ trợ. Chỉ hỗ trợ PDF, DOCX, TXT, MD" | Reject upload |
| File too large | 400 | "File quá lớn. Tối đa 50MB" | Reject upload |
| Text extraction failed | 200 | Warning in response | Store file, mark text_content as null |
| Class not found | 404 | "Không tìm thấy lớp học" | Reject upload |

### Highlight/Note Errors

| Error | HTTP Code | Message | Action |
|-------|-----------|---------|--------|
| Document not found | 404 | "Không tìm thấy tài liệu" | Reject action |
| Unauthorized access | 403 | "Bạn không có quyền truy cập" | Reject action |
| Note too long | 400 | "Ghi chú tối đa 1000 ký tự" | Reject action |
| Invalid position | 400 | "Vị trí không hợp lệ" | Reject action |

### AI Service Errors

| Error | HTTP Code | Message | Action |
|-------|-----------|---------|--------|
| AI service unavailable | 503 | "Dịch vụ AI tạm thời không khả dụng" | Return fallback message |
| Rate limit exceeded | 429 | "Vui lòng thử lại sau ít phút" | Queue request |
| Context too long | 400 | "Đoạn văn bản quá dài để phân tích" | Truncate context |

### WebSocket Errors

| Error | Action |
|-------|--------|
| Connection failed | Retry with exponential backoff |
| Authentication failed | Redirect to login |
| Heartbeat timeout | Reconnect |

## Testing Strategy

### Unit Tests

- Document upload validation
- Text extraction for each file type
- Highlight/Note CRUD operations
- Attendance rate calculations
- Session report generation
- Export to CSV/PDF

### Property-Based Tests

Using `hypothesis` (Python) for backend:

1. **Document storage completeness** - Generate random documents, verify all fields stored
2. **Highlight privacy** - Generate random student pairs, verify isolation
3. **Note character limit** - Generate strings of various lengths, verify validation
4. **Attendance rate calculation** - Generate random attendance data, verify formula
5. **At-risk flagging** - Generate rates around 80% threshold, verify correct flagging
6. **Search accuracy** - Generate documents and queries, verify results contain query

### Integration Tests

- WebSocket notification flow (upload → broadcast → receive)
- Offline queue sync flow
- AI explanation flow (highlight → context → AI → response)
- Session report generation after class ends

### E2E Tests

- Teacher uploads document → Student receives notification → Student views document
- Student highlights text → Requests AI explanation → Saves explanation
- Class ends → Session report generated → Teacher views report
- Student attendance drops → Warning notification sent

## Performance Considerations

### Caching

- Document list: Cache per class, invalidate on new upload
- Document content: Cache in local storage for offline access
- Attendance stats: Cache for 5 minutes, invalidate on new check-in

### Pagination

- Document list: 20 documents per page
- Highlights: 50 per document
- Attendance history: 30 records per page

### File Storage

- Store files in `/uploads/documents/{class_id}/{document_id}/`
- Generate thumbnails for PDFs
- Compress text content for storage

### WebSocket Optimization

- Use rooms for class-specific broadcasts
- Batch notifications for multiple events
- Heartbeat every 30 seconds
