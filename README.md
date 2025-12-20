# Smart Attendance System

Hệ thống điểm danh thông minh sử dụng nhận dạng khuôn mặt và kiểm tra liveness cho mobile app.

## Tech Stack

### Backend
- **Python 3.13**
- **FastAPI** - Web framework
- **OpenCV** - Computer vision cho face detection
- **ONNX Runtime** - Model inference cho face recognition
- **SQLite** - Database (stored in face_db/)

### Frontend
- **React Native** với **Expo**
- **Expo Camera** - Camera functionality
- **TypeScript** - Type safety

## Cấu trúc Project

```
smart-attendance/
├── backend/                 # Python FastAPI server
│   ├── main.py             # Main API server
│   ├── face_detect.py      # Face detection utilities
│   ├── face_model.py       # Face embedding extraction
│   ├── face_match.py       # Face similarity matching
│   ├── attendance_liveness.py # Liveness detection with session management
│   ├── models/             # Pre-trained models
│   ├── face_db/            # Stored face embeddings
│   ├── venv/               # Python virtual environment
│   └── requirements.txt    # Python dependencies
├── frontend/                # React Native Expo app
│   ├── app/                # App screens (file-based routing)
│   ├── components/         # Reusable UI components
│   ├── constants/          # App constants
│   └── package.json        # Node dependencies
└── README.md               # This file
```

## Setup Instructions

### Prerequisites

**MongoDB:**
- Cài đặt MongoDB và chạy service
- Default connection: `mongodb://localhost:27017`

**Python Dependencies:**
```bash
# Install additional system dependencies (Ubuntu/Debian)
sudo apt-get install python3-dev build-essential
```

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed sample data (optional - creates test accounts)
python seed_data.py

# Run the server (use port 8001 to avoid conflicts)
uvicorn main:app --reload --host 0.0.0.0 --port 8001 --log-level info
```

Backend sẽ chạy tại `http://localhost:8001`

**Lưu ý:**
- Đảm bảo MongoDB đang chạy trước khi start server
- Nếu port 8001 bị conflict, có thể dùng port khác như 8002, 8003, etc.

### Sample Accounts (Plain Text Passwords - sau khi chạy seed_data.py)

**Teachers:**
- Username: `teacher1`, Password: `password123` (Nguyễn Văn A)
- Username: `teacher2`, Password: `password123` (Hoàng Văn E)

**Students:**
- Username: `student1`, Password: `password123` (Trần Thị B - Has FaceID)
- Username: `student2`, Password: `password123` (Lê Văn C - No FaceID, needs setup)
- Username: `student3`, Password: `password123` (Phạm Thị D - Has FaceID)

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Expo development server
npm start

# Or run on specific platform
npm run android  # Android emulator
npm run ios      # iOS simulator
npm run web      # Web browser
```

**API Configuration**: Frontend tự động detect platform:
- **Android Emulator**: `http://10.0.2.2:8001`
- **iOS Simulator**: `http://localhost:8001`
- **Web**: `http://localhost:8001`

Xem `frontend/README_API_CONFIG.md` để cấu hình nâng cao.
```

## API Endpoints

### Authentication
```
POST /auth/register
```
- Body: `{"username": "string", "email": "string", "password": "string", "full_name": "string", "role": "student|teacher", "student_id": "string"}`

```
POST /auth/login
```
- Body: `{"username": "string", "password": "string"}`
- Returns: `{"access_token": "string", "token_type": "bearer"}`

```
POST /auth/logout
```
- Headers: `Authorization: Bearer <token>`

### Student Dashboard
```
GET /student/dashboard
```
- Headers: `Authorization: Bearer <token>`
- Returns: Student schedule, attendance stats for today

```
GET /student/class/{class_id}/documents
```
- Headers: `Authorization: Bearer <token>`
- Returns: Documents shared in the class

### Attendance (Unified)
```
POST /attendance/checkin
```
- Headers: `Authorization: Bearer <token>`
- Body: `{"class_id": "string", "image": "base64_string", "latitude": float, "longitude": float}`
- Unified check-in with face verification and GPS location

### Real-time (WebSocket)
```
WS /ws
```
- WebSocket connection for real-time teacher status updates

### Legacy Endpoints (still supported)
```
POST /face/register
POST /attendance/image
GET /models/info
GET /health
```

## Usage Flow

### Mobile App Flow:

#### **Đăng ký & Đăng nhập:**
1. **Đăng ký**: Tạo tài khoản student/teacher
2. **Đăng nhập**: Sử dụng username/password để đăng nhập
3. **Dashboard**: Hiển thị theo role (student/teacher)

#### **Student Dashboard:**
1. **Xem lịch học**: Thời khóa biểu ngày hôm đó với thông tin:
   - Tên môn học, giáo viên, giờ học, phòng
   - Trạng thái điểm danh (đã điểm danh/chưa)
2. **Điểm danh**: Click vào môn học → nhấn "📍 Điểm danh"
   - Tự động lấy vị trí GPS
   - Chụp ảnh khuôn mặt để verify
   - Backend kiểm tra face + location
3. **Xem tài liệu**: Click vào môn học → xem tài liệu được chia sẻ

#### **Real-time Features:**
- Theo dõi trạng thái online của giáo viên
- Cập nhật điểm danh realtime
- Thông báo khi có tài liệu mới

### Technical Implementation:
- **Database**: MongoDB với collections (users, classes, attendance, documents)
- **Authentication**: JWT tokens với role-based access
- **Face Verification**: Mô hình `samplenet.onnx` + cosine similarity
- **Location**: GPS coordinates validation
- **Real-time**: WebSocket connections cho live updates

## Development Notes

- Face embeddings được lưu trong `backend/face_db/` dưới dạng pickle files
- Models được tải tự động từ internet nếu chưa có trong `backend/models/`
- Similarity threshold mặc định là 0.5, có thể điều chỉnh trong code
- Liveness detection dựa trên movement score giữa các frames

## Monitoring & Debugging

### Backend Logs
Backend sử dụng logging chi tiết để theo dõi hoạt động:

```bash
# Chạy server để xem logs real-time
cd backend
venv\Scripts\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8000 --log-level info
```

**Các log levels:**
- 🚀 **INFO**: Các hoạt động chính (registration, attendance, model loading)
- ⚠️ **WARNING**: Các vấn đề không nghiêm trọng
- ❌ **ERROR**: Lỗi cần xử lý
- 🔍 **DEBUG**: Chi tiết debug (có thể bật bằng `--log-level debug`)

### Health Check
```
GET /health
```
Trả về trạng thái của tất cả services và số lượng faces đã đăng ký.

### Models Info
```
GET /models/info
```
Kiểm tra trạng thái models và threshold.

## Troubleshooting

### Backend Issues
- Đảm bảo camera permissions được cấp
- Kiểm tra models được download thành công
- Xem logs để debug face detection failures
- Kiểm tra `/health` endpoint để monitor trạng thái

### Frontend Issues
- Đảm bảo Expo CLI được cài đặt
- Clear cache nếu có lỗi: `expo r -c`
- Restart Metro bundler nếu hot reload không hoạt động
- Kiểm tra console logs trong Expo Go để xem network errors

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request
