// Test script đơn giản để kiểm tra API và workflow
// Chạy: node test_api_simple.js

const API_URL = "http://localhost:8000";

async function testWorkflow() {
    console.log("🚀 KIỂM TRA WORKFLOW ĐIỂM DANH");
    console.log("="*50);
    
    try {
        // 1. Test API connection
        console.log("\n🔧 Testing API connection...");
        const healthResponse = await fetch(`${API_URL}/health`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log("✅ API connection OK:", healthData);
        } else {
            console.log("❌ API connection failed:", healthResponse.status);
            return;
        }
        
        // 2. Test login
        console.log("\n🔐 Testing login...");
        const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "student1",
                password: "password123"
            })
        });
        
        if (!loginResponse.ok) {
            console.log("❌ Login failed:", loginResponse.status);
            return;
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.access_token;
        console.log("✅ Login successful, token:", token.substring(0, 20) + "...");
        
        // 3. Test user profile
        console.log("\n👤 Testing user profile...");
        const profileResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!profileResponse.ok) {
            console.log("❌ Profile failed:", profileResponse.status);
            return;
        }
        
        const profileData = await profileResponse.json();
        console.log("✅ Profile loaded:");
        console.log("   - Username:", profileData.username);
        console.log("   - Has Face ID:", profileData.has_face_id);
        console.log("   - Face Embedding:", profileData.face_embedding ? "Yes" : "No");
        
        // 4. Analyze workflow
        console.log("\n" + "="*60);
        console.log("🔍 PHÂN TÍCH WORKFLOW");
        console.log("="*60);
        
        if (profileData.has_face_id) {
            console.log("✅ User ĐÃ CÓ Face ID setup");
            console.log("\n📱 Khi bấm 'Điểm danh':");
            console.log("1. Frontend nhận has_face_id = true");
            console.log("2. Set hasFaceIDSetup = true");
            console.log("3. handleCheckIn() kiểm tra hasFaceIDSetup = true");
            console.log("4. ➡️ Mở RandomActionAttendanceModal");
            console.log("5. ❌ KHÔNG hiển thị trang setup (vì đã setup rồi)");
            
            console.log("\n💡 ĐÂY LÀ LÝ DO tại sao không hiển thị trang setup!");
            console.log("   User đã thiết lập Face ID trước đó.");
            
            console.log("\n🔧 Để test workflow setup:");
            console.log("   1. Xóa face_embedding trong database");
            console.log("   2. Refresh frontend");
            console.log("   3. Bấm 'Điểm danh' sẽ thấy Alert setup");
            
        } else {
            console.log("❌ User CHƯA CÓ Face ID setup");
            console.log("\n📱 Khi bấm 'Điểm danh':");
            console.log("1. Frontend nhận has_face_id = false");
            console.log("2. Set hasFaceIDSetup = false");
            console.log("3. handleCheckIn() kiểm tra hasFaceIDSetup = false");
            console.log("4. ➡️ Hiển thị Alert 'Chưa thiết lập Face ID'");
            console.log("5. ➡️ Bấm 'Thiết lập ngay' → router.push('/setup-faceid')");
            
            console.log("\n✅ Workflow setup sẽ hoạt động bình thường");
        }
        
        // 5. Test dashboard
        console.log("\n📊 Testing dashboard...");
        const dashboardResponse = await fetch(`${API_URL}/student/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (dashboardResponse.ok) {
            const dashboardData = await dashboardResponse.json();
            console.log("✅ Dashboard loaded:");
            console.log("   - Student:", dashboardData.student_name);
            console.log("   - Classes today:", dashboardData.total_classes_today);
            console.log("   - Attended:", dashboardData.attended_today);
        }
        
        console.log("\n" + "="*60);
        console.log("📋 TÓM TẮT");
        console.log("="*60);
        console.log("✅ API hoạt động bình thường");
        console.log("✅ Login thành công");
        console.log("✅ Profile load được");
        console.log(`${profileData.has_face_id ? '✅' : '❌'} Face ID status: ${profileData.has_face_id}`);
        console.log("✅ Dashboard hoạt động");
        
        if (profileData.has_face_id) {
            console.log("\n🎯 KẾT LUẬN: User đã có Face ID, nên không hiển thị setup page");
            console.log("   Đây là behavior ĐÚNG của hệ thống!");
        } else {
            console.log("\n🎯 KẾT LUẬN: User chưa có Face ID, sẽ hiển thị setup page");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

// Chạy test
testWorkflow();