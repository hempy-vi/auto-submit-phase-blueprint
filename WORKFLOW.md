# Workflow tự động Submit Phase trên hệ thống Blueprint (CyberLogitec)

Đặc tả nghiệp vụ + hành vi UI thật (Webix) dùng làm tài liệu tham chiếu khi
sửa `src/blueprintActions.js`/`src/selectors.js`/`src/runner.js`. Selector
trong tài liệu này đã được xác nhận qua test trực tiếp trên production.

## 1. Bối cảnh nghiệp vụ

Ticket đi qua 4 Phase tuần tự: **Register → Confirmation → Solving →
Finish**, mỗi Phase có 1 PIC phụ trách. Khi tới lượt mình, PIC vào ticket, bấm
**Submit** kèm 1 comment ngắn rồi bấm **OK** để đẩy ticket sang Phase kế tiếp.
Tool tự động hoá đúng việc đó cho các Phase mà người dùng là PIC:

| Phase | Nội dung Submit |
|---|---|
| Confirmation | "Confirmed" |
| Solving | "Solved" |
| Finish | "Finished" |

Register không cần Submit tay (tự động khi tạo task ở tool khác). Chỉ hỗ trợ
đúng 3 Phase trên (`src/config.js` → `PHASE_SUBMIT_CONTENT`) vì nội dung
comment là quy ước nghiệp vụ cố định — thêm Phase khác phải xác nhận nội dung
tương ứng trước khi sửa code, không được tự suy ra.

`--phase`/`--assignee` có thể bỏ qua trên CLI nếu đã set `BLUEPRINT_PHASE`/
`BLUEPRINT_FULL_NAME` trong `.env` (mỗi thiết bị/người dùng tự cấu hình giá
trị mặc định riêng — xem `src/config.js` → `getDefaultPhase`/`getDefaultAssignees`).

## 2. Luồng thao tác UI thật

### Đăng nhập + chọn Project

Vào thẳng app Blueprint (không phải domain `auth.*`) để nó tự redirect sang
đúng form login. Sau khi login, **bắt buộc chọn Project "ERP Maintenance"**
trước khi làm gì khác — project mặc định của tài khoản là "CAPA Management",
có luồng Phase hoàn toàn khác (6 phase: Register/1st Confirm/2nd Confirm/
Approval/Focal Acceptance/...) nên nếu không chủ động đổi, toàn bộ ticket
search ra sẽ sai phạm vi.

**Không chọn tiếp module con** trong cây bên trái (khác với tool tạo task
`auto-log-task-blueprint`, vốn bắt buộc chọn "Logistics") — vì ticket của
người dùng có thể nằm rải rác ở nhiều module khác nhau (Data Model/
Logistics/Human Resource/Accounting), chọn 1 module sẽ bỏ sót ticket ở các
module còn lại.

Chọn Project qua popup Webix (`.webix_popup .webix_list_item`) khớp CHÍNH XÁC
tên (không phải substring `:has-text()`) + không phân biệt hoa/thường —
tránh chọn nhầm nếu tài khoản có thêm project khác chứa cùng 1 phần tên.

### Advance Search: Phase + Assignee

Toggle "Advance Search" là 1 Webix switch — đọc `aria-checked` trước khi
click để tránh bấm nhầm chiều (tắt cái đang bật). Ô Phase và Assignee là
Webix multicombo (gõ + chọn tag):
- Gõ bằng `pressSequentially()`, KHÔNG dùng `fill()` — Webix multicombo cần
  sự kiện bàn phím thật để kích hoạt search-as-you-type, `fill()` không kích
  hoạt được việc lọc lại danh sách option.
- Chọn option khớp CHÍNH XÁC + không phân biệt hoa/thường (regex neo đầu/cuối
  `^...$`), không dùng `:has-text()` — nhiều Phase/tên người dùng lồng nhau
  hoặc trùng 1 phần dễ khớp nhầm option khác.

Ô Phase liệt kê TOÀN BỘ tên Phase từng dùng trong hệ thống (không lọc theo
Project đang chọn) — vì vậy việc chọn đúng Project ở bước trên vẫn là điều
kiện bắt buộc để lọc ĐÚNG PHẠM VI TICKET, không phải để giới hạn option Phase.

### Bảng kết quả search

Bảng kết quả (`view_id="gridReq"`) là Webix datatable dạng **CỘT-CHÍNH** —
mỗi cột là 1 div `.webix_column` chứa các ô `.webix_cell` xếp dọc, KHÔNG PHẢI
`<table>/<tr>` thường. Mỗi ô có `aria-rowindex`/`aria-colindex`; cột 1 là mã
ticket (#). Đếm số dòng kết quả = đếm số ô cột 1; double-click ô
`aria-colindex="1" aria-rowindex="1"` mở Detail ở **TAB TRÌNH DUYỆT MỚI** (bắt
bằng `context.waitForEvent('page')`).

### Submit trên trang Detail

`#btnSubmit` mặc định `visibility:hidden` — chỉ hiện khi ticket đang ở đúng
Phase mà người dùng đăng nhập là PIC phụ trách (đúng lý do phải lọc Assignee
= chính mình trước khi search). Click `#btnSubmit` → hiện `#txtSubmit`
(`<textarea>` thật, KHÔNG PHẢI CKEditor — `.fill()` dùng được trực tiếp,
khác các form CKEditor ở tool tạo task) + `#btnOK`.

Bấm `#btnOK` là hành động THẬT, không hoàn tác được — tab sẽ tự động đóng sau
vài giây, quay về màn hình search (đã tự bấm thật + xác nhận trên production:
ticket chuyển đúng sang Phase kế tiếp, đúng PIC mới). Nếu tab không tự đóng
trong thời gian chờ, tool KHÔNG coi đó là lỗi thường: có thể server đã ghi
nhận Submit thành công dù tab chưa kịp đóng, nên không tự đóng tab tay và
không tự động xử lý ticket kế tiếp (tránh Submit lần 2 lên đúng ticket đó) —
xem mục 3.

### Vòng lặp batch

Xử lý ticket đầu tiên trong kết quả, rồi bấm Search lại (ticket vừa xử lý
biến mất khỏi kết quả vì đã đổi Phase) và lặp lại tới khi hết ticket khớp.
Nếu đếm được 0 ticket ngay sau khi search, tool chờ thêm rồi đếm lại 1 lần
trước khi kết luận "hết ticket" — tránh kết luận nhầm lúc grid chưa kịp
render xong. Nếu 1 ticket lỗi, tool ghi log + thử tiếp ticket kế tiếp, TRỪ
khi: ticket đó lại xuất hiện ở vị trí đầu kết quả ngay vòng kế tiếp (dấu hiệu
ticket bị kẹt, dừng hẳn để tránh lặp vô hạn), hoặc trình duyệt/tab chính đã
đóng.

## 3. Hạn chế và rủi ro đã biết

- **Chưa xử lý phân trang/virtualization khi có nhiều hơn 1 trang kết quả**
  (Webix chỉ render ~25 dòng/trang). Vì tool luôn xử lý dòng đầu tiên rồi
  search lại, việc này không ảnh hưởng ticket nào bị bỏ sót giữa các trang,
  nhưng số đếm "còn N ticket khớp" hiển thị mỗi vòng chỉ phản ánh số dòng
  đang render (trang hiện tại), không phải tổng số ticket khớp thật nếu vượt
  quá 1 trang.
- **Trạng thái "Cần kiểm tra tay"** (`results.ambiguous`): khi OK đã click
  thật (hoặc chính lệnh click ném lỗi giữa chừng — coi như không chắc chắn)
  nhưng tab không xác nhận tự đóng được trong thời gian chờ, tool dừng batch,
  KHÔNG tự đóng tab đó, và KHÔNG tự đóng cả trình duyệt cho tới khi người dùng
  tự kiểm tra xong và nhấn Enter xác nhận (`index.js`) — không có cách nào tự
  động phân biệt "server chỉ chậm" với "lỗi thật" từ phía tool.
- **Phát hiện ticket bị kẹt** chỉ dừng batch lại (không có cách bỏ qua ticket
  đó để xử lý tiếp ticket khác), vì tool không có cách yêu cầu Blueprint loại
  trừ 1 ticket cụ thể khỏi kết quả Advance Search.

## 4. Tình trạng implement

- [x] Đăng nhập (`login.*`)
- [x] Chọn Project "ERP Maintenance" (không chọn module)
- [x] Advance Search: bật toggle, chọn Phase + Assignee (combo type-ahead, khớp chính xác)
- [x] Đọc bảng kết quả (đếm dòng, tóm tắt dòng đầu tiên) + mở Detail ở tab mới
- [x] Bấm Submit + điền nội dung theo Phase (`openSubmitForm`)
- [x] Bấm OK thật + tab tự đóng (`confirmSubmit`) — đã tự bấm thật + xác nhận
      trên production (ticket chuyển đúng Phase kế tiếp, đúng PIC mới)
- [x] Vòng lặp batch: search → xử lý → search lại, dừng khi hết ticket khớp
- [x] Xử lý lỗi từng ticket (bỏ qua, thử tiếp) trừ ticket bị kẹt hoặc trình
      duyệt đã đóng
- [x] Tách riêng trạng thái "Cần kiểm tra tay" khi OK đã click nhưng tab
      không xác nhận đóng được
- [ ] Xử lý phân trang/virtualization khi kết quả vượt quá 1 trang
