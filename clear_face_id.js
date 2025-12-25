// Script để xóa Face ID của user để test workflow setup
// Chạy: node clear_face_id.js

const { MongoClient } = require('mongodb');

async function clearFaceID() {
    const client = new MongoClient('mongodb://localhost:27017');
    
    try {
        await client.connect();
        console.log("🔗 Connected to MongoDB");
        
        const db = client.db('smart_attendance');
        const users = db.collection('users');
        
        // Kiểm tra user hiện tại
        const user = await users.findOne({ username: 'student1' });
        if (!user) {
            console.log("❌ User student1 not found");
            return;
        }
        
        console.log("👤 Current user status:");
        console.log("   - Username:", user.username);
        console.log("   - Has face_embedding:", !!user.face_embedding);
        
        if (user.face_embedding) {
            console.log("   - Embedding type:", typeof user.face_embedding);
            if (typeof user.face_embedding === 'object' && user.face_embedding.data) {
                console.log("   - Embedding data length:", user.face_embedding.data.length);
            }
        }
        
        // Xóa Face ID
        console.log("\n🗑️ Clearing Face ID...");
        const result = await users.updateOne(
            { username: 'student1' },
            { $unset: { face_embedding: "" } }
        );
        
        if (result.modifiedCount > 0) {
            console.log("✅ Face ID cleared successfully!");
            console.log("\n📱 Bây giờ khi bấm 'Điểm danh' sẽ hiển thị Alert setup");
            console.log("   1. Refresh frontend");
            console.log("   2. Bấm 'Điểm danh'");
            console.log("   3. Sẽ thấy Alert 'Chưa thiết lập Face ID'");
            console.log("   4. Bấm 'Thiết lập ngay' → Navigate to setup page");
        } else {
            console.log("⚠️ No changes made (Face ID was already empty)");
        }
        
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.close();
    }
}

async function restoreFaceID() {
    const client = new MongoClient('mongodb://localhost:27017');
    
    try {
        await client.connect();
        console.log("🔗 Connected to MongoDB");
        
        const db = client.db('smart_attendance');
        const users = db.collection('users');
        
        // Tạo fake Face ID để restore
        const fakeFaceEmbedding = {
            data: Array(512).fill(0).map(() => Math.random()),
            shape: [512],
            dtype: "float32",
            norm: "L2",
            created_at: new Date(),
            samples_count: 15,
            setup_type: "pose_diversity"
        };
        
        console.log("🔄 Restoring Face ID...");
        const result = await users.updateOne(
            { username: 'student1' },
            { $set: { face_embedding: fakeFaceEmbedding } }
        );
        
        if (result.modifiedCount > 0) {
            console.log("✅ Face ID restored successfully!");
            console.log("\n📱 Bây giờ khi bấm 'Điểm danh' sẽ mở attendance modal");
        } else {
            console.log("⚠️ No changes made");
        }
        
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.close();
    }
}

// Kiểm tra command line arguments
const action = process.argv[2];

if (action === 'clear') {
    clearFaceID();
} else if (action === 'restore') {
    restoreFaceID();
} else {
    console.log("🔧 Face ID Management Tool");
    console.log("Usage:");
    console.log("  node clear_face_id.js clear    - Xóa Face ID để test setup workflow");
    console.log("  node clear_face_id.js restore  - Restore Face ID để test attendance workflow");
}