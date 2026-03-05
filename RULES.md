# QUY CHUẨN PHÁT TRIỂN DỰ ÁN (MVC ARCHITECTURE)

Dự án hiện tại được xây dựng theo kiến trúc **MVC (Model - View - Controller)** kết hợp với mô hình tiến trình của **Electron** (Main Process & Renderer Process). Kiến trúc hiện tại ổn định, bảo mật (nhờ Preload script và tắt nodeIntegration) và đơn giản hóa cho nhu cầu cá nhân.

Ứng dụng được thiết kế **CÁ NHÂN HÓA (Personal Workspace)** tập trung vào 2 module chính là: **Todo List** và **Ghi chú (Notes)**. Hoàn toàn chạy nội bộ trên máy tính cá nhân, offline và không cần server.

Khi cần thêm một tính năng mới hay chỉnh sửa code, BẮT BUỘC phải tuân thủ nghiêm ngặt quy trình sau đây để giữ đồng bộ code:

---

## 📌 THÔNG TIN QUAN TRỌNG: VỊ TRÍ DATABASE (SQLite)
Ứng dụng sử dụng cơ sở dữ liệu SQLite (`app.db`). Vị trí lưu trữ file này phụ thuộc vào môi trường chạy:
- **Ngay lúc Phát triển (Dev Mode):** File `app.db` sẽ được sinh ra trực tiếp ở thư mục gốc của project này (`fee/app.db`). Bạn có thể dùng extension DB Browser for SQLite để xem. 
- **Khi Build/Đóng gói (Production Mode):** File `app.db` tự động chuyển vào thư mục `userData` an toàn của hệ điều hành (Ví dụ: `~/Library/Application Support/fee/app.db` trên Mac, hoặc `%APPDATA%/fee/app.db` trên Windows).
*Lưu ý: Không dùng tính năng tài khoản hệ thống (Roles/Permissions), đăng nhập hay quản lý user (RBAC). App không có backend API bên thứ 3. Mọi cơ sở dữ liệu lưu cục bộ local-first data.*

---

## BƯỚC 1: QUẢN LÝ MODEL (Thao tác với SQLite)
**Vị trí:** `src/models/`

1. Các tham số Database init tại file `src/models/database.js` 
2. File Model CHỈ chứa các hàm thao tác trực tiếp với CSDL (SQLite) qua Promises, ví dụ: `todoModel.js`, `noteModel.js`.
3. Không thêm các trường liên đới cấu trúc đa người dùng như `owner_id`, `role`, `department_id` v.v. Tất cả được coi là local user context (1 user duy nhất dùng máy tính).
4. Format chuẩn: trả về object `{ success: true, data: ... }` nếu thành công, hoặc `{ success: false, error: ... }` nếu lỗi.

## BƯỚC 2: TẠO/QUẢN LÝ CONTROLLER (Cầu nối IPC)
**Vị trí:** `src/controllers/`

1. Controller (vd `todoController.js`) chứa các đăng ký sự kiện `ipcMain.handle(...)`.
2. Tách biệt hoàn toàn phần DB fetch sang Model. Tại controller chỉ xử lý logic business và luồng Electron (Window/Notification v.v.).
3. Xử lý try/catch bắt lỗi để không crash app.

## BƯỚC 3: ĐĂNG KÝ CONTROLLER VÀO MAIN PROCESS
**Vị trí:** `src/main/main.js`

1. Chỉnh sửa luồng ở file `src/main/main.js`.
2. Gọi hàm khởi tạo Controller vào bên trong `bootstrap()` (ví dụ `initTodoController()`).

## BƯỚC 4: EXPOSE IPC QUA PRELOAD SCRIPT (Bảo mật giao tiếp)
**Vị trí:** `src/main/preload.js`

1. Update exposed APIs tại hàm `contextBridge.exposeInMainWorld('api', { ... })`.
2. Client Renderer KHÔNG được phép `require('fs')` hay truy cập Node API nào khác ngoài các method được chừa sẵn qua `window.api`.

## BƯỚC 5: TẠO/CẬP NHẬT VIEW (Giao diện và Logic UI)
**Vị trí:** `src/views/...`

1. Ứng dụng là dạng Single-Page Application (SPA) load trên file gốc `src/views/admin/dashboard.html`. Template HTML của module con (Todo, Notes) được inject động qua lệnh Fetch HTML từ `window.api.loadTemplate`.
2. File js của View (vd `todo.js`) gọi dữ liệu qua `window.api.getTodos()` (sử dụng async/await). Code HTML/CSS tách bạch hoàn toàn với Logic JS.
3. Giao diện được thiết kế theo Style Modern / Glassmorphism / Dark Mode using TailwindCSS cấu trúc inline tĩnh. Tránh style rườm rà, tập trung giữ chuẩn nguyên dạng mockup Any.do đã tạo ra. 
4. Không còn tính năng kiểm tra phân quyền. Renderer xử lý trực tiếp luôn DOM interaction dựa vào App Context.

---

## TỔNG KẾT LUỒNG CHẠY (DATA FLOW)
`View (HTML/JS)` ➡️ gọi `window.api.doSomething()` ➡️ `Preload.js` ➡️ Gửi sự kiện IPC ➡️ `Controller.js` (nhận sự kiện) ➡️ gọi `Model.js` ➡️ thao tác SQLite ➡️ `Model.js` trả kết quả ➡️ `Controller` trả kết quả qua IPC ➡️ `View` nhận kết quả await Promise và Render UI tương ứng.

**Lưu ý:** Luôn trân trọng UI/UX mượt mà local-first. Giữ nguyên sự đơn giản.
