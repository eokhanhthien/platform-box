# QUY CHUẨN PHÁT TRIỂN DỰ ÁN (MVC ARCHITECTURE)

Dự án hiện tại được xây dựng theo kiến trúc **MVC (Model - View - Controller)** kết hợp với mô hình tiến trình của **Electron** (Main Process & Renderer Process). Kiến trúc hiện tại **rất ổn định, bảo mật (nhờ Preload script và tắt nodeIntegration) và dễ mở rộng**.

Khi bạn hoặc người khác cần thêm một tính năng mới (Ví dụ: Thêm tính năng Quản lý `Product`, `Customer` hay `Department`), BẮT BUỘC phải tuân thủ nghiêm ngặt quy trình 5 bước sau đây để giữ đồng bộ code:

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

---

## TỔNG KẾT LUỒNG CHẠY (DATA FLOW)
`View (HTML/JS)` ➡️ gọi `window.api.doSomething()` ➡️ `Preload.js` ➡️ Gửi sự kiện IPC ➡️ `Controller.js` (nhận sự kiện) ➡️ gọi `Model.js` ➡️ thao tác SQLite ➡️ `Model.js` trả kết quả ➡️ `Controller` trả kết quả qua IPC ➡️ `View` nhận kết quả và Render UI.

**Lưu ý:** Luôn tái sử dụng các components UI hiện có (Modal, Table layout, Alert) để duy trì sự nhất quán của thiết kế tổng thể.
