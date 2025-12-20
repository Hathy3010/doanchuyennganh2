# API Configuration Guide

## Cách cấu hình API_URL cho các môi trường khác nhau

### 🔧 **Tự động Detection (Khuyến nghị)**

Sử dụng file `config/api.ts` để tự động detect platform:

```typescript
import { API_URL } from "../config/api";

// Sử dụng API_URL trong code
const response = await fetch(`${API_URL}/auth/login`, {
  // ... options
});
```

### 📱 **Platform Detection Logic**

```typescript
const getApiUrl = (): string => {
  // Android emulator: 10.0.2.2 để truy cập host machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8001';
  }

  // iOS simulator: localhost
  if (Platform.OS === 'ios') {
    return 'http://localhost:8001';
  }

  // Web development: localhost
  return 'http://localhost:8001';
};
```

### 🌐 **Môi trường và URL tương ứng**

| Môi trường | Platform.OS | API_URL | Ghi chú |
|------------|-------------|---------|---------|
| Android Emulator | `android` | `http://10.0.2.2:8001` | Special IP để truy cập host |
| iOS Simulator | `ios` | `http://localhost:8001` | Localhost từ simulator |
| Web Browser | `web` | `http://localhost:8001` | Local development |
| Physical Android | `android` | `http://[YOUR_IP]:8001` | Thay YOUR_IP bằng IP máy host |
| Physical iOS | `ios` | `http://[YOUR_IP]:8001` | Thay YOUR_IP bằng IP máy host |

### 🖥️ **Cách tìm IP của máy development**

#### Windows:
```cmd
ipconfig
```
Tìm IPv4 Address của network adapter đang dùng.

#### macOS/Linux:
```bash
ifconfig
# hoặc
ip addr show
```

### ⚙️ **Backend Port Configuration**

Backend chạy trên port `8001` (có thể thay đổi trong `main.py`):

```python
# Trong main.py
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### 🔄 **Thay đổi Port**

Nếu cần thay đổi port:

1. **Backend**: Sửa port trong `main.py` và restart server
2. **Frontend**: Cập nhật `config/api.ts`:
   ```typescript
   // Thay đổi từ 8001 thành port mới
   return 'http://10.0.2.2:8002';  // Ví dụ
   ```

### 🐛 **Troubleshooting**

#### **Connection Refused trên Android Emulator**
- Đảm bảo backend chạy trên `0.0.0.0` (không phải `127.0.0.1`)
- Kiểm tra firewall không chặn port
- Test: `curl http://localhost:8001/health` từ máy host

#### **Connection Refused trên Physical Device**
- Thay `10.0.2.2` bằng IP thực của máy development
- Đảm bảo cả máy development và device ở cùng network
- Kiểm tra firewall

#### **Expo Go không kết nối**
- Restart Expo server: `expo r -c`
- Clear cache: `expo start --clear`
- Restart Metro bundler

### 📝 **Manual Configuration (Không khuyến nghị)**

Nếu không muốn dùng auto-detection, có thể hardcode:

```typescript
// Chỉ dùng cho Android emulator
const API_URL = "http://10.0.2.2:8001";

// Chỉ dùng cho local development
const API_URL = "http://localhost:8001";

// Chỉ dùng cho physical device
const API_URL = "http://192.168.1.100:8001"; // Thay bằng IP thực
```

Nhưng cách này **không linh hoạt** khi chuyển đổi môi trường!

### ✅ **Best Practices**

1. **Luôn dùng `config/api.ts`** cho auto-detection
2. **Test trên tất cả platforms** trước khi deploy
3. **Document IP addresses** khi làm việc nhóm
4. **Sử dụng environment variables** cho production
5. **Restart Expo** khi thay đổi config

### 🚀 **Quick Test**

Để test API connection:

```bash
# Backend health check
curl http://localhost:8001/health

# Test từ Android emulator
# Trong Expo console, check network requests
```

Với cấu hình này, app sẽ tự động chọn đúng API URL cho mỗi môi trường! 🎯
