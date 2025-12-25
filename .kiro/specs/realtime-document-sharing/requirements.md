# Requirements Document

## Introduction

Hệ thống chia sẻ tài liệu realtime giữa giáo viên và sinh viên, cho phép sinh viên xem tài liệu trực tiếp trong app, bôi đen (highlight) đoạn không hiểu, ghi chú cá nhân, và sử dụng AI để giải thích đoạn được bôi đen.

## Glossary

- **Document_System**: Hệ thống quản lý và chia sẻ tài liệu
- **WebSocket_Manager**: Quản lý kết nối WebSocket cho realtime updates
- **Highlight**: Đoạn văn bản được sinh viên bôi đen để đánh dấu không hiểu
- **Note**: Ghi chú cá nhân của sinh viên trên tài liệu
- **AI_Assistant**: Module AI hỗ trợ giải thích nội dung được highlight
- **Document_Viewer**: Component hiển thị tài liệu trong app

## Requirements

### Requirement 1: Upload và Chia Sẻ Tài Liệu (Giáo Viên)

**User Story:** As a teacher, I want to upload and share documents with my class, so that students can access learning materials in real-time.

#### Acceptance Criteria

1. WHEN a teacher uploads a document THEN THE Document_System SHALL store the document and associate it with the class
2. WHEN a teacher shares a document THEN THE WebSocket_Manager SHALL broadcast a notification to all enrolled students
3. THE Document_System SHALL support PDF, DOCX, TXT, and MD file formats
4. WHEN a document is uploaded THEN THE Document_System SHALL extract text content for highlighting and AI analysis
5. THE Document_System SHALL store document metadata including title, description, upload_time, and file_size

### Requirement 2: Realtime Document Notification

**User Story:** As a student, I want to receive instant notifications when my teacher shares a new document, so that I can access it immediately.

#### Acceptance Criteria

1. WHEN a teacher shares a document THEN THE WebSocket_Manager SHALL send a notification to all online students in the class
2. WHEN a student is offline THEN THE Document_System SHALL store the notification for delivery when they come online
3. WHEN a notification is received THEN THE Student_App SHALL display a toast/alert with document title and teacher name
4. THE notification SHALL include document_id, title, teacher_name, class_name, and timestamp

### Requirement 3: Document Viewer

**User Story:** As a student, I want to view documents directly in the app, so that I don't need to download or use external apps.

#### Acceptance Criteria

1. WHEN a student opens a document THEN THE Document_Viewer SHALL render the document content within the app
2. THE Document_Viewer SHALL support scrolling, zooming, and page navigation for multi-page documents
3. WHEN viewing a document THEN THE Document_Viewer SHALL display document title, teacher name, and upload date
4. THE Document_Viewer SHALL maintain reading position when the student returns to a document
5. WHEN the document content is text-based THEN THE Document_Viewer SHALL enable text selection for highlighting

### Requirement 4: Highlight (Bôi Đen) Functionality

**User Story:** As a student, I want to highlight text passages I don't understand, so that I can mark them for review or AI explanation.

#### Acceptance Criteria

1. WHEN a student selects text in the document THEN THE Document_Viewer SHALL show a highlight action menu
2. WHEN a student confirms highlight THEN THE Document_System SHALL save the highlight with position, text content, and timestamp
3. THE Document_System SHALL support multiple highlight colors (yellow, green, blue, red)
4. WHEN viewing a document THEN THE Document_Viewer SHALL display all saved highlights for that student
5. WHEN a student taps a highlight THEN THE Document_Viewer SHALL show options: explain with AI, add note, delete highlight
6. THE Document_System SHALL store highlights per student (private) - other students cannot see each other's highlights

### Requirement 5: Personal Notes

**User Story:** As a student, I want to add personal notes to documents, so that I can record my thoughts and questions.

#### Acceptance Criteria

1. WHEN a student creates a note THEN THE Document_System SHALL associate it with a specific position in the document
2. THE Note SHALL support text content up to 1000 characters
3. WHEN viewing a document THEN THE Document_Viewer SHALL display note indicators at their positions
4. WHEN a student taps a note indicator THEN THE Document_Viewer SHALL show the note content in a popup
5. THE Document_System SHALL allow editing and deleting notes
6. THE Document_System SHALL store notes per student (private)

### Requirement 6: AI-Assisted Explanation

**User Story:** As a student, I want AI to explain highlighted text, so that I can understand difficult concepts without waiting for the teacher.

#### Acceptance Criteria

1. WHEN a student requests AI explanation for a highlight THEN THE AI_Assistant SHALL generate an explanation based on the highlighted text
2. THE AI_Assistant SHALL consider the document context (surrounding paragraphs) when generating explanations
3. THE AI_Assistant SHALL provide explanations in Vietnamese
4. WHEN generating explanation THEN THE AI_Assistant SHALL show a loading indicator
5. THE AI_Assistant SHALL allow students to ask follow-up questions about the explanation
6. THE Document_System SHALL save AI explanations for future reference
7. IF the AI cannot generate a meaningful explanation THEN THE AI_Assistant SHALL suggest the student ask the teacher

### Requirement 7: Document List and Management

**User Story:** As a student, I want to see all shared documents organized by class, so that I can easily find and access them.

#### Acceptance Criteria

1. THE Document_System SHALL display documents grouped by class
2. THE Document_System SHALL show document status: new, viewed, has_highlights, has_notes
3. WHEN a student views a document THEN THE Document_System SHALL mark it as viewed
4. THE Document_System SHALL support searching documents by title or content
5. THE Document_System SHALL sort documents by upload date (newest first) by default

### Requirement 8: Teacher Document Analytics

**User Story:** As a teacher, I want to see which students have viewed my documents, so that I can track engagement.

#### Acceptance Criteria

1. THE Document_System SHALL track view count and unique viewers for each document
2. THE Document_System SHALL show teacher a list of students who have viewed each document
3. THE Document_System SHALL display view statistics: total views, unique viewers, average time spent
4. WHEN a student highlights text THEN THE Document_System SHALL aggregate anonymous highlight statistics for the teacher
5. THE teacher SHALL see which sections are most highlighted (indicating difficult content) without seeing individual student highlights

### Requirement 9: WebSocket Connection Management

**User Story:** As a system, I want to manage WebSocket connections efficiently, so that realtime features work reliably.

#### Acceptance Criteria

1. WHEN a student opens the document section THEN THE WebSocket_Manager SHALL establish a connection
2. WHEN the connection drops THEN THE WebSocket_Manager SHALL attempt reconnection with exponential backoff
3. THE WebSocket_Manager SHALL support multiple concurrent connections (one per student)
4. WHEN a student disconnects THEN THE WebSocket_Manager SHALL clean up resources and mark student as offline
5. THE WebSocket_Manager SHALL send heartbeat messages every 30 seconds to maintain connection

### Requirement 10: Offline Support

**User Story:** As a student, I want to access previously viewed documents offline, so that I can study without internet.

#### Acceptance Criteria

1. WHEN a student views a document THEN THE Document_System SHALL cache the document content locally
2. WHEN offline THEN THE Document_Viewer SHALL display cached documents with an offline indicator
3. WHEN offline THEN THE Document_System SHALL queue highlights and notes for sync when online
4. WHEN connection is restored THEN THE Document_System SHALL sync queued changes to the server
5. THE Document_System SHALL limit offline cache to 50MB per student


### Requirement 11: Thống Kê Điểm Danh Theo Buổi Học

**User Story:** As a teacher, I want to see attendance statistics after each class session, so that I can track student participation.

#### Acceptance Criteria

1. WHEN a class session ends THEN THE Attendance_System SHALL generate a session attendance report
2. THE session report SHALL include: total students, present count, absent count, late count, attendance rate percentage
3. THE session report SHALL list each student with their status (present, absent, late, excused)
4. WHEN viewing session report THEN THE Teacher_Dashboard SHALL display check-in time for each present student
5. THE Attendance_System SHALL highlight students with GPS-invalid attempts or Face ID failures
6. THE Teacher_Dashboard SHALL allow exporting session report to CSV/PDF
7. WHEN a session report is generated THEN THE WebSocket_Manager SHALL notify the teacher in realtime

### Requirement 12: Thống Kê Điểm Danh Theo Kỳ Học

**User Story:** As a teacher, I want to see semester-wide attendance statistics, so that I can evaluate overall student engagement and identify at-risk students.

#### Acceptance Criteria

1. THE Attendance_System SHALL calculate semester attendance rate for each student
2. THE semester report SHALL include: total sessions, attended sessions, missed sessions, attendance percentage per student
3. THE Teacher_Dashboard SHALL display attendance trend chart (line graph) over the semester
4. WHEN a student's attendance rate drops below 80% THEN THE Attendance_System SHALL flag them as "at-risk"
5. THE Teacher_Dashboard SHALL show a ranked list of students by attendance rate
6. THE Attendance_System SHALL calculate class average attendance rate per session
7. THE semester report SHALL support filtering by date range (custom period)
8. THE Teacher_Dashboard SHALL allow exporting semester report to CSV/PDF/Excel

### Requirement 13: Thống Kê Điểm Danh Cho Sinh Viên

**User Story:** As a student, I want to see my own attendance statistics, so that I can track my participation and avoid falling below required attendance.

#### Acceptance Criteria

1. THE Student_Dashboard SHALL display personal attendance rate for each enrolled class
2. THE Student_Dashboard SHALL show attendance history with dates and status (present, absent, late)
3. WHEN attendance rate drops below 80% THEN THE Student_App SHALL display a warning notification
4. THE Student_Dashboard SHALL display remaining allowed absences before reaching critical threshold
5. THE Student_Dashboard SHALL show attendance comparison with class average (anonymous)
6. WHEN viewing attendance history THEN THE Student_App SHALL display check-in details (time, GPS status, Face ID status)
