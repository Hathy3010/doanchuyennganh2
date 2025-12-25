"""
Attendance Statistics Service
Handles session reports, semester statistics, and student attendance tracking.
"""

import io
import csv
import logging
from datetime import datetime, date
from typing import List, Optional, Tuple
from bson import ObjectId
from fastapi import HTTPException

from database import (
    attendance_collection, classes_collection, users_collection,
    session_reports_collection, gps_invalid_attempts_collection
)

logger = logging.getLogger("attendance_stats_service")

# Configuration
AT_RISK_THRESHOLD = 0.8  # 80% attendance rate
MAX_ALLOWED_ABSENCES = 3  # Default max absences before critical


class AttendanceStatsService:
    """Service for attendance statistics and reports"""
    
    # ==================== Session Reports ====================
    
    async def generate_session_report(
        self,
        class_id: str,
        report_date: str
    ) -> dict:
        """
        Generate attendance report for a single class session.
        
        Args:
            class_id: Class ID
            report_date: Date string (YYYY-MM-DD)
            
        Returns:
            Session report dict
        """
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        # Get enrolled students
        student_ids = class_doc.get("student_ids", [])
        total_students = len(student_ids)
        
        if total_students == 0:
            raise HTTPException(status_code=400, detail="Lớp học chưa có sinh viên")
        
        # Get attendance records for this date
        attendance_records = {}
        cursor = attendance_collection.find({
            "class_id": ObjectId(class_id),
            "date": report_date
        })
        
        async for record in cursor:
            attendance_records[str(record["student_id"])] = record
        
        # Get GPS invalid attempts
        gps_invalid = {}
        gps_cursor = gps_invalid_attempts_collection.find({
            "class_id": class_id,
            "date": report_date
        })
        async for attempt in gps_cursor:
            gps_invalid[attempt["student_id"]] = attempt
        
        # Build student list
        students = []
        present_count = 0
        absent_count = 0
        late_count = 0
        
        for student_id in student_ids:
            student_id_str = str(student_id)
            
            # Get student info
            student = await users_collection.find_one({"_id": student_id})
            student_name = student.get("full_name", student.get("username", "Unknown")) if student else "Unknown"
            
            # Get attendance record
            record = attendance_records.get(student_id_str)
            
            # Determine status
            status = "absent"
            check_in_time = None
            gps_status = "ok"
            face_id_status = "ok"
            warnings = []
            
            if record:
                status = record.get("status", "present")
                check_in_time = record.get("check_in_time")
                
                # Check validations
                validations = record.get("validations", {})
                if validations.get("gps", {}).get("is_valid") == False:
                    gps_status = "invalid"
                    warnings.append("GPS không hợp lệ")
                
                if validations.get("embedding", {}).get("is_valid") == False:
                    face_id_status = "invalid"
                    warnings.append("Face ID không khớp")
                
                if status == "present":
                    present_count += 1
                elif status == "late":
                    late_count += 1
                    present_count += 1  # Late still counts as present
            else:
                absent_count += 1
            
            # Check GPS invalid attempts
            if student_id_str in gps_invalid:
                attempt = gps_invalid[student_id_str]
                warnings.append(f"GPS invalid attempts: {attempt.get('attempt_count', 0)}")
            
            students.append({
                "student_id": student_id_str,
                "student_name": student_name,
                "status": status,
                "check_in_time": check_in_time.isoformat() if check_in_time else None,
                "gps_status": gps_status,
                "face_id_status": face_id_status,
                "warnings": warnings
            })
        
        # Calculate attendance rate
        attendance_rate = round((present_count / total_students) * 100, 2) if total_students > 0 else 0
        
        # Create report
        report = {
            "class_id": ObjectId(class_id),
            "class_name": class_doc.get("class_name", class_doc.get("name", "")),
            "date": report_date,
            "total_students": total_students,
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "attendance_rate": attendance_rate,
            "students": students,
            "generated_at": datetime.utcnow()
        }
        
        # Save report
        await session_reports_collection.update_one(
            {"class_id": ObjectId(class_id), "date": report_date},
            {"$set": report},
            upsert=True
        )
        
        logger.info(f"📊 Session report generated for class {class_id} on {report_date}")
        
        return self._session_report_to_response(report)
    
    async def get_session_report(
        self,
        class_id: str,
        report_date: str
    ) -> dict:
        """Get existing session report or generate new one"""
        report = await session_reports_collection.find_one({
            "class_id": ObjectId(class_id),
            "date": report_date
        })
        
        if report:
            return self._session_report_to_response(report)
        
        # Generate if not exists
        return await self.generate_session_report(class_id, report_date)
    
    # ==================== Semester Reports ====================
    
    async def get_semester_report(
        self,
        class_id: str,
        start_date: str,
        end_date: str
    ) -> dict:
        """
        Generate semester attendance report for a class.
        
        Args:
            class_id: Class ID
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            
        Returns:
            Semester report dict
        """
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        student_ids = class_doc.get("student_ids", [])
        total_students = len(student_ids)
        
        if total_students == 0:
            raise HTTPException(status_code=400, detail="Lớp học chưa có sinh viên")
        
        # Get all session reports in date range
        session_reports = []
        cursor = session_reports_collection.find({
            "class_id": ObjectId(class_id),
            "date": {"$gte": start_date, "$lte": end_date}
        }).sort("date", 1)
        
        async for report in cursor:
            session_reports.append(report)
        
        total_sessions = len(session_reports)
        
        # Calculate per-student statistics
        student_stats = {}
        for student_id in student_ids:
            student_id_str = str(student_id)
            student_stats[student_id_str] = {
                "attended": 0,
                "absent": 0,
                "late": 0
            }
        
        # Aggregate from session reports
        for report in session_reports:
            for student in report.get("students", []):
                student_id_str = student.get("student_id")
                if student_id_str in student_stats:
                    status = student.get("status", "absent")
                    if status == "present":
                        student_stats[student_id_str]["attended"] += 1
                    elif status == "late":
                        student_stats[student_id_str]["attended"] += 1
                        student_stats[student_id_str]["late"] += 1
                    else:
                        student_stats[student_id_str]["absent"] += 1
        
        # Build student list with rates
        students = []
        at_risk_count = 0
        total_attendance_rate = 0
        
        for student_id in student_ids:
            student_id_str = str(student_id)
            stats = student_stats.get(student_id_str, {"attended": 0, "absent": 0, "late": 0})
            
            # Get student info
            student = await users_collection.find_one({"_id": student_id})
            student_name = student.get("full_name", student.get("username", "Unknown")) if student else "Unknown"
            
            # Calculate attendance rate
            attendance_rate = round((stats["attended"] / total_sessions) * 100, 2) if total_sessions > 0 else 0
            total_attendance_rate += attendance_rate
            
            # Check at-risk
            is_at_risk = attendance_rate < (AT_RISK_THRESHOLD * 100)
            if is_at_risk:
                at_risk_count += 1
            
            students.append({
                "student_id": student_id_str,
                "student_name": student_name,
                "attended_sessions": stats["attended"],
                "absent_sessions": stats["absent"],
                "late_sessions": stats["late"],
                "attendance_rate": attendance_rate,
                "is_at_risk": is_at_risk
            })
        
        # Sort by attendance rate (lowest first for at-risk visibility)
        students.sort(key=lambda x: x["attendance_rate"])
        
        # Calculate class average
        class_average = round(total_attendance_rate / total_students, 2) if total_students > 0 else 0
        
        # Build trend data (attendance rate per session)
        trend_data = []
        for report in session_reports:
            trend_data.append({
                "date": report.get("date"),
                "attendance_rate": report.get("attendance_rate", 0)
            })
        
        return {
            "class_id": class_id,
            "class_name": class_doc.get("class_name", class_doc.get("name", "")),
            "start_date": start_date,
            "end_date": end_date,
            "total_sessions": total_sessions,
            "total_students": total_students,
            "class_average_attendance": class_average,
            "at_risk_count": at_risk_count,
            "at_risk_threshold": AT_RISK_THRESHOLD * 100,
            "students": students,
            "trend_data": trend_data,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    async def get_student_attendance_rate(
        self,
        student_id: str,
        class_id: str
    ) -> float:
        """Get attendance rate for a specific student in a class"""
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        # Count total sessions
        total_sessions = await session_reports_collection.count_documents({
            "class_id": ObjectId(class_id)
        })
        
        if total_sessions == 0:
            return 0.0
        
        # Count attended sessions
        attended_sessions = await attendance_collection.count_documents({
            "class_id": ObjectId(class_id),
            "student_id": ObjectId(student_id),
            "status": {"$in": ["present", "late"]}
        })
        
        return round((attended_sessions / total_sessions) * 100, 2)
    
    async def get_at_risk_students(
        self,
        class_id: str,
        threshold: float = AT_RISK_THRESHOLD
    ) -> List[dict]:
        """
        Get list of students with attendance rate below threshold.
        
        Args:
            class_id: Class ID
            threshold: Attendance rate threshold (default 0.8 = 80%)
            
        Returns:
            List of at-risk students
        """
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        student_ids = class_doc.get("student_ids", [])
        
        # Count total sessions
        total_sessions = await session_reports_collection.count_documents({
            "class_id": ObjectId(class_id)
        })
        
        if total_sessions == 0:
            return []
        
        at_risk_students = []
        
        for student_id in student_ids:
            # Count attended sessions
            attended_sessions = await attendance_collection.count_documents({
                "class_id": ObjectId(class_id),
                "student_id": student_id,
                "status": {"$in": ["present", "late"]}
            })
            
            attendance_rate = attended_sessions / total_sessions
            
            if attendance_rate < threshold:
                # Get student info
                student = await users_collection.find_one({"_id": student_id})
                student_name = student.get("full_name", student.get("username", "Unknown")) if student else "Unknown"
                
                remaining_absences = self._calculate_remaining_absences(
                    total_sessions - attended_sessions,
                    total_sessions
                )
                
                at_risk_students.append({
                    "student_id": str(student_id),
                    "student_name": student_name,
                    "attendance_rate": round(attendance_rate * 100, 2),
                    "attended_sessions": attended_sessions,
                    "missed_sessions": total_sessions - attended_sessions,
                    "remaining_absences": remaining_absences,
                    "risk_level": self._get_risk_level(attendance_rate)
                })
        
        # Sort by attendance rate (lowest first)
        at_risk_students.sort(key=lambda x: x["attendance_rate"])
        
        return at_risk_students
    
    async def get_class_average_attendance(self, class_id: str) -> float:
        """Get average attendance rate for a class"""
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        student_ids = class_doc.get("student_ids", [])
        if not student_ids:
            return 0.0
        
        total_rate = 0.0
        for student_id in student_ids:
            rate = await self.get_student_attendance_rate(str(student_id), class_id)
            total_rate += rate
        
        return round(total_rate / len(student_ids), 2)
    
    # ==================== Student Personal Stats ====================
    
    async def get_student_stats(
        self,
        student_id: str,
        class_id: str
    ) -> dict:
        """
        Get personal attendance statistics for a student.
        
        Args:
            student_id: Student ID
            class_id: Class ID
            
        Returns:
            Student attendance stats dict
        """
        # Get class info
        class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
        # Get student info
        student = await users_collection.find_one({"_id": ObjectId(student_id)})
        if not student:
            raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
        
        # Count sessions
        total_sessions = await session_reports_collection.count_documents({
            "class_id": ObjectId(class_id)
        })
        
        # Get attendance records
        attended_count = 0
        late_count = 0
        absent_count = 0
        
        cursor = attendance_collection.find({
            "class_id": ObjectId(class_id),
            "student_id": ObjectId(student_id)
        })
        
        attendance_history = []
        async for record in cursor:
            status = record.get("status", "absent")
            if status == "present":
                attended_count += 1
            elif status == "late":
                attended_count += 1
                late_count += 1
            
            attendance_history.append({
                "date": record.get("date"),
                "status": status,
                "check_in_time": record.get("check_in_time").isoformat() if record.get("check_in_time") else None
            })
        
        # Calculate absent (sessions without attendance record)
        absent_count = total_sessions - attended_count
        
        # Calculate attendance rate
        attendance_rate = round((attended_count / total_sessions) * 100, 2) if total_sessions > 0 else 0
        
        # Get class average for comparison
        class_average = await self.get_class_average_attendance(class_id)
        
        # Calculate remaining absences
        remaining_absences = self._calculate_remaining_absences(absent_count, total_sessions)
        
        # Determine status
        is_at_risk = attendance_rate < (AT_RISK_THRESHOLD * 100)
        
        return {
            "student_id": student_id,
            "student_name": student.get("full_name", student.get("username", "")),
            "class_id": class_id,
            "class_name": class_doc.get("class_name", class_doc.get("name", "")),
            "total_sessions": total_sessions,
            "attended_sessions": attended_count,
            "late_sessions": late_count,
            "absent_sessions": absent_count,
            "attendance_rate": attendance_rate,
            "class_average": class_average,
            "comparison": round(attendance_rate - class_average, 2),
            "remaining_absences": remaining_absences,
            "max_allowed_absences": MAX_ALLOWED_ABSENCES,
            "is_at_risk": is_at_risk,
            "risk_level": self._get_risk_level(attendance_rate / 100) if is_at_risk else "safe",
            "attendance_history": sorted(attendance_history, key=lambda x: x["date"] or "", reverse=True)
        }
    
    async def get_remaining_absences(
        self,
        student_id: str,
        class_id: str,
        max_absences: int = MAX_ALLOWED_ABSENCES
    ) -> int:
        """Get remaining allowed absences for a student"""
        # Count current absences
        total_sessions = await session_reports_collection.count_documents({
            "class_id": ObjectId(class_id)
        })
        
        attended_sessions = await attendance_collection.count_documents({
            "class_id": ObjectId(class_id),
            "student_id": ObjectId(student_id),
            "status": {"$in": ["present", "late"]}
        })
        
        current_absences = total_sessions - attended_sessions
        remaining = max_absences - current_absences
        
        return max(0, remaining)
    
    # ==================== Export Functions ====================
    
    async def export_to_csv(self, report: dict, report_type: str = "session") -> bytes:
        """
        Export report to CSV format.
        
        Args:
            report: Report dict (session or semester)
            report_type: "session" or "semester"
            
        Returns:
            CSV bytes
        """
        output = io.StringIO()
        
        if report_type == "session":
            # Session report CSV
            writer = csv.writer(output)
            writer.writerow([
                "Lớp", report.get("class_name", ""),
                "Ngày", report.get("date", "")
            ])
            writer.writerow([])
            writer.writerow([
                "Tổng sinh viên", report.get("total_students", 0),
                "Có mặt", report.get("present_count", 0),
                "Vắng", report.get("absent_count", 0),
                "Đi trễ", report.get("late_count", 0),
                "Tỷ lệ", f"{report.get('attendance_rate', 0)}%"
            ])
            writer.writerow([])
            writer.writerow([
                "MSSV", "Họ tên", "Trạng thái", "Giờ điểm danh", 
                "GPS", "Face ID", "Cảnh báo"
            ])
            
            for student in report.get("students", []):
                writer.writerow([
                    student.get("student_id", ""),
                    student.get("student_name", ""),
                    student.get("status", ""),
                    student.get("check_in_time", ""),
                    student.get("gps_status", ""),
                    student.get("face_id_status", ""),
                    "; ".join(student.get("warnings", []))
                ])
        
        else:
            # Semester report CSV
            writer = csv.writer(output)
            writer.writerow([
                "Lớp", report.get("class_name", ""),
                "Từ", report.get("start_date", ""),
                "Đến", report.get("end_date", "")
            ])
            writer.writerow([])
            writer.writerow([
                "Tổng buổi học", report.get("total_sessions", 0),
                "Tổng sinh viên", report.get("total_students", 0),
                "Tỷ lệ TB lớp", f"{report.get('class_average_attendance', 0)}%",
                "SV có nguy cơ", report.get("at_risk_count", 0)
            ])
            writer.writerow([])
            writer.writerow([
                "MSSV", "Họ tên", "Số buổi có mặt", "Số buổi vắng",
                "Số buổi trễ", "Tỷ lệ điểm danh", "Có nguy cơ"
            ])
            
            for student in report.get("students", []):
                writer.writerow([
                    student.get("student_id", ""),
                    student.get("student_name", ""),
                    student.get("attended_sessions", 0),
                    student.get("absent_sessions", 0),
                    student.get("late_sessions", 0),
                    f"{student.get('attendance_rate', 0)}%",
                    "Có" if student.get("is_at_risk") else "Không"
                ])
        
        output.seek(0)
        return output.getvalue().encode('utf-8-sig')  # UTF-8 with BOM for Excel
    
    async def export_to_pdf(self, report: dict, report_type: str = "session") -> bytes:
        """
        Export report to PDF format.
        Note: This is a simplified implementation. For production, use reportlab or weasyprint.
        
        Args:
            report: Report dict
            report_type: "session" or "semester"
            
        Returns:
            PDF bytes (placeholder - returns text for now)
        """
        # For now, return a text representation
        # In production, use reportlab or weasyprint for proper PDF generation
        logger.warning("PDF export is using placeholder implementation. Use reportlab for production.")
        
        lines = []
        
        if report_type == "session":
            lines.append(f"BÁO CÁO ĐIỂM DANH BUỔI HỌC")
            lines.append(f"Lớp: {report.get('class_name', '')}")
            lines.append(f"Ngày: {report.get('date', '')}")
            lines.append("")
            lines.append(f"Tổng sinh viên: {report.get('total_students', 0)}")
            lines.append(f"Có mặt: {report.get('present_count', 0)}")
            lines.append(f"Vắng: {report.get('absent_count', 0)}")
            lines.append(f"Tỷ lệ: {report.get('attendance_rate', 0)}%")
            lines.append("")
            lines.append("DANH SÁCH SINH VIÊN:")
            
            for student in report.get("students", []):
                status_text = {
                    "present": "Có mặt",
                    "absent": "Vắng",
                    "late": "Đi trễ"
                }.get(student.get("status", ""), student.get("status", ""))
                lines.append(f"  - {student.get('student_name', '')}: {status_text}")
        
        else:
            lines.append(f"BÁO CÁO ĐIỂM DANH HỌC KỲ")
            lines.append(f"Lớp: {report.get('class_name', '')}")
            lines.append(f"Từ: {report.get('start_date', '')} đến {report.get('end_date', '')}")
            lines.append("")
            lines.append(f"Tổng buổi học: {report.get('total_sessions', 0)}")
            lines.append(f"Tỷ lệ TB lớp: {report.get('class_average_attendance', 0)}%")
            lines.append(f"Sinh viên có nguy cơ: {report.get('at_risk_count', 0)}")
            lines.append("")
            lines.append("DANH SÁCH SINH VIÊN:")
            
            for student in report.get("students", []):
                risk_text = " ⚠️ CÓ NGUY CƠ" if student.get("is_at_risk") else ""
                lines.append(f"  - {student.get('student_name', '')}: {student.get('attendance_rate', 0)}%{risk_text}")
        
        return "\n".join(lines).encode('utf-8')
    
    # ==================== Helper Methods ====================
    
    def _session_report_to_response(self, report: dict) -> dict:
        """Convert MongoDB document to API response"""
        return {
            "class_id": str(report.get("class_id", "")),
            "class_name": report.get("class_name", ""),
            "date": report.get("date", ""),
            "total_students": report.get("total_students", 0),
            "present_count": report.get("present_count", 0),
            "absent_count": report.get("absent_count", 0),
            "late_count": report.get("late_count", 0),
            "attendance_rate": report.get("attendance_rate", 0),
            "students": report.get("students", []),
            "generated_at": report.get("generated_at").isoformat() if report.get("generated_at") else None
        }
    
    def _calculate_remaining_absences(self, current_absences: int, total_sessions: int) -> int:
        """Calculate remaining allowed absences"""
        # Dynamic max based on total sessions (e.g., 20% of total)
        dynamic_max = max(MAX_ALLOWED_ABSENCES, int(total_sessions * 0.2))
        remaining = dynamic_max - current_absences
        return max(0, remaining)
    
    def _get_risk_level(self, attendance_rate: float) -> str:
        """Get risk level based on attendance rate"""
        if attendance_rate >= AT_RISK_THRESHOLD:
            return "safe"
        elif attendance_rate >= 0.6:
            return "warning"
        elif attendance_rate >= 0.4:
            return "high"
        else:
            return "critical"


# Create singleton instance
attendance_stats_service = AttendanceStatsService()
