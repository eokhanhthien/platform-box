# QUY CHUẨN PHÁT TRIỂN DỰ ÁN (MVC ARCHITECTURE)

Dự án hiện tại được xây dựng theo kiến trúc **MVC (Model - View - Controller)** kết hợp với mô hình tiến trình của **Electron** (Main Process & Renderer Process). Kiến trúc hiện tại **rất ổn định, bảo mật (nhờ Preload script và tắt nodeIntegration) và dễ mở rộng**.

Khi bạn hoặc người khác cần thêm một tính năng mới (Ví dụ: Thêm tính năng Quản lý `Product`, `Customer` hay `Department`), BẮT BUỘC phải tuân thủ nghiêm ngặt quy trình 5 bước sau đây để giữ đồng bộ code:

---

## 📌 THÔNG TIN QUAN TRỌNG: VỊ TRÍ DATABASE (SQLite)
Ứng dụng sử dụng cơ sở dữ liệu SQLite (`app.db`). Vị trí lưu trữ file này phụ thuộc vào môi trường chạy:
- **Ngay lúc Phát triển (Dev Mode):** File `app.db` sẽ được sinh ra trực tiếp ở thư mục gốc của project này (`fee/app.db`). Bạn có thể dễ dàng mở file này bằng các phần mềm như DB Browser for SQLite để xem/edit dữ liệu.
- **Khi Build/Đóng gói (Production Mode):** File `app.db` sẽ được tự động chuyển vào thư mục `userData` an toàn của hệ điều hành (Ví dụ: `~/Library/Application Support/fee/app.db` trên Mac, hoặc `%APPDATA%/fee/app.db` trên Win). Điều này giúp tránh lỗi thiếu quyền truy cập thư mục cài đặt (`Permission Denied`).

---

## BƯỚC 1: TẠO MODEL (Thao tác với Cơ sở dữ liệu)
**Vị trí:** `src/models/`

1. Khai báo bảng mới (nếu cần) bên trong file `src/models/database.js` tại hàm `initDB`.
2. Tạo một file Model mới, ví dụ: `productModel.js`.
3. File này CHỈ chứa các hàm thao tác trực tiếp với thẻ CSDL (SQLite) qua Promises.
   * Format chuẩn: Trả về một object `{ success: true, data: ... }` nếu thành công, hoặc `{ success: false, error: ... }` nếu thất bại. Hoặc `resolve/reject`.
   * Ví dụ các hàm: `getProducts()`, `addProduct(product)`, `updateProduct(id, product)`, `deleteProduct(id)`.

## BƯỚC 2: TẠO CONTROLLER (Cầu nối IPC từ Main Process)
**Vị trí:** `src/controllers/`

1. Tạo một file Controller mới, ví dụ: `productController.js`.
2. Import các hàm từ Model vừa tạo.
3. Tạo một hàm khởi tạo (ví dụ: `initProductController()`) chứa các đăng ký sự kiện `ipcMain.handle(...)`.
4. Trong các handle này, gọi dữ liệu từ Model, xử lý try/catch bắt lỗi, và return kết quả về cho Renderer.

## BƯỚC 3: ĐĂNG KÝ CONTROLLER VÀO MAIN PROCESS
**Vị trí:** `src/main/main.js`

1. Mở file `src/main/main.js`.
2. Import hàm init của Controller mới: `const { initProductController } = require('../controllers/productController');`
3. Gọi hàm này bên trong hàm `bootstrap()` CÙNG CHỖ với các controller khác (sau khi initDB và trước khi createWindow).

## BƯỚC 4: EXPOSE IPC QUA PRELOAD SCRIPT (Bảo mật giao tiếp)
**Vị trí:** `src/main/preload.js`

1. Mở file `src/main/preload.js`.
2. Khai báo thêm các hàm mới ở trong object `contextBridge.exposeInMainWorld('api', { ... })`.
3. Ví dụ:
   ```javascript
   getProducts: () => ipcRenderer.invoke('getProducts'),
   addProduct: (data) => ipcRenderer.invoke('addProduct', data),
   updateProduct: (id, data) => ipcRenderer.invoke('updateProduct', id, data),
   deleteProduct: (id) => ipcRenderer.invoke('deleteProduct', id)
   ```

## BƯỚC 5: TẠO VIEW (Giao diện và Logic UI)
**Vị trí:** `src/views/...`

1. Gọi các API đã được expose từ preload thông qua đối tượng toàn cục `window.api`.
   * Ví dụ: `const res = await window.api.getProducts();`
2. Tách bạch hoàn toàn Code Giao diện (HTML/CSS) và Code Logic (Javascript).
   * Không viết thẻ `<script>` dài thòng lọng trong file `.html`. Dùng `<script src="filename.js"></script>`.
3. Khi cần load thư viện ngoại (jQuery, Select2, ChartJS...), tải file `.min.js` và `.min.css` đưa vào thư mục `src/views/assets/` và gọi qua thẻ script đường dẫn tương đối. TUYỆT ĐỐI không dùng `require()` ngoài file HTML ở Renderer để tránh lỗi `nodeIntegration`!
4. **Quản lý Cấu hình Tập trung:** Nếu có các danh sách dữ liệu tĩnh cấu hình ứng dụng (như các loại `Role`, `Department`, `Categories`...), hãy khai báo vào file cấu hình dùng chung `src/views/config.js` (gắn vào thẻ `<script>` trong HTML trước các file logic) để lấy ra dùng qua biến `window.APP_CONFIG`. Tuyệt đối không hardcode cứng trên mã HTML.

## BƯỚC 6: CHIA MODULE THEO TÍNH NĂNG (CHUẨN FRAMEWORK)
**Vị trí:** `src/views/tên-module`

Để tránh file JS/HTML bị phình to (ví dụ `dashboard.js` dài hàng ngàn dòng), dự án tuân thủ cấu trúc **Modularize theo Navbar**:

1. File `dashboard.js` chỉ là **Router Component**. Nó làm nhiệm vụ quản lý bộ khung, tạo Sidebar từ Config và chuyển đổi qua lại giữa các `sectionId` trên DOM.
2. Mỗi tính năng trên Navbar phải có một **Thư mục riêng** nằm trong `src/views/` (vd: `src/views/users/`, `src/views/permissions/`).
3. Toàn bộ Logic Load dữ liệu, Phân quyền thao tác, Xử lý Modal thêm/sửa/xoá của tính năng đó phải được di chuyển vào file JS nằm trong thư mục tương ứng (vd: `users/users.js`).
4. Tại file HTML tổng `dashboard.html`, tạo một bao lưới bọc HTML như `<div id="section-tên-module" class="module-section">` và gọi `<script src="../tên-module/tên-module.js">` ở phần cuối body.

## BƯỚC 7: ÁP DỤNG PHÂN QUYỀN RBAC VÀO GIAO DIỆN (Ẩn/Hiện Nút)
**Vị trí:** `src/views/filename.js`

Hệ thống sử dụng **Ma Trận Phân Quyền Động (Action-Based RBAC)** được nạp từ Database. Khi render View, tuyệt đối không được hardcode quyền (ví dụ: `if (currentUser.role === 'Admin')`), mà phải bám theo cấu trúc `PERMISSIONS`.

1. **Lấy quyền của User hiện tại cho Module đang dev:**
   ```javascript
   // Ví dụ lấy quyền cho module 'products'
   const rolePerms = window.APP_CONFIG.PERMISSIONS[currentUser.role] || {};
   const modulePerms = rolePerms['products'] || [];
   ```
2. **Kiểm tra quyền View (Xem trang):**
   ```javascript
   if (!modulePerms.includes('view') && currentUser.role !== 'Admin') {
       // Ẩn bảng dữ liệu, hiện thông báo không có quyền
       document.querySelector('#productTable').style.display = 'none';
       return;
   }
   ```
3. **Ẩn/Hiện nút Thêm, Sửa, Xóa (Create, Update, Delete):**
   ```javascript
   // Nút Thêm Mới
   if (modulePerms.includes('create') || currentUser.role === 'Admin') {
       document.querySelector('#btnAddProduct').style.display = 'block';
   } else {
       document.querySelector('#btnAddProduct').style.display = 'none';
   }

   // Trong vòng lặp render Table, chỉ render nút Sửa/Xóa nếu có quyền
   let actionsHTML = '';
   if (modulePerms.includes('update') || currentUser.role === 'Admin') {
       actionsHTML += `<button onclick="edit(${id})">Sửa</button>`;
   }
   if (modulePerms.includes('delete') || currentUser.role === 'Admin') {
       actionsHTML += `<button onclick="del(${id})">Xóa</button>`;
   }
   ```
   *Lưu ý: Role `Admin` luôn được ngầm định bypass mọi quyền hành để tránh rủi ro mất quyền kiểm soát hệ thống.*

---

## TỔNG KẾT LUỒNG CHẠY (DATA FLOW)
`View (HTML/JS)` ➡️ gọi `window.api.doSomething()` ➡️ `Preload.js` ➡️ Gửi sự kiện IPC ➡️ `Controller.js` (nhận sự kiện) ➡️ gọi `Model.js` ➡️ thao tác SQLite ➡️ `Model.js` trả kết quả ➡️ `Controller` trả kết quả qua IPC ➡️ `View` nhận kết quả và Render UI.

**Lưu ý:** Luôn tái sử dụng các components UI hiện có (Modal, Table layout, Alert) để duy trì sự nhất quán của thiết kế tổng thể.
