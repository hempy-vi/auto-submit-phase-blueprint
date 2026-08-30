# auto-submit-phase-blueprint

Tool Node.js + Playwright tự động tìm ticket theo **Phase + Assignee** trên hệ
thống Blueprint (CyberLogitec) qua Advance Search, rồi tự bấm **Submit** (kèm
nội dung comment cố định theo Phase: Confirmation → "Confirmed", Solving →
"Solved", Finish → "Finished") cho từng ticket một, lặp lại tới khi hết ticket
khớp. Đặc tả nghiệp vụ đầy đủ nằm ở [WORKFLOW.md](./WORKFLOW.md) — đọc file đó
trước khi sửa code, đặc biệt mục 3 (hạn chế/rủi ro đã biết) và mục 4 (checklist
tình trạng implement).

## Cấu trúc

```
src/config.js             hằng số nghiệp vụ + bảng Phase -> nội dung Submit + giá trị mặc định từ .env
src/cliArgs.js            parse --phase/--assignee dùng chung cho index.js + scripts/*
src/selectors.js          CSS selector của Blueprint
src/blueprintActions.js   hành động Playwright (login, chọn Project, Advance Search, Submit 1 ticket)
src/runner.js             vòng lặp batch: search -> xử lý ticket đầu tiên -> search lại -> lặp tới khi hết
src/loadEnv.js            nạp file .env
scripts/smoke-test.js         search thử theo Phase/Assignee, chỉ in kết quả, KHÔNG Submit
scripts/test-one-ticket.js    test trên đúng 1 ticket -- mặc định dừng trước khi bấm OK, cần CONFIRM=yes mới bấm OK thật
index.js                  CLI entry point
setup.bat                 (Windows) cài dependency + tạo .env lần đầu
run.bat                   (Windows) dry-run -> xác nhận -> chạy thật
```

## Cài đặt (Windows — nhanh)

```
setup.bat
```

Chạy 1 lần trên mỗi máy: cài Node.js nếu thiếu (qua winget), cài dependency
(`npm install`), cài trình duyệt Chromium cho Playwright, tự tạo `.env` từ
`.env.example` nếu chưa có. Mở `.env`, điền `BLUEPRINT_USERNAME`/
`BLUEPRINT_PASSWORD` thật, và tuỳ chọn `BLUEPRINT_FULL_NAME`/`BLUEPRINT_PHASE`
(xem bên dưới) trước khi chạy tiếp — file `.env` đã nằm trong `.gitignore`,
không bị commit lên git.

## Chạy (Windows — nhanh)

```
run.bat --phase Confirmation --assignee "<Tên Assignee>"
```

Tự động: (1) chạy dry-run, chỉ tìm + in ra ticket đầu tiên sẽ xử lý (không mở
Submit), (2) hỏi xác nhận (gõ `Y`), (3) chỉ khi xác nhận mới chạy thật, Submit
lần lượt từng ticket khớp. **Luôn đọc kỹ kết quả dry-run trước khi gõ Y** — đây
là hành động thật, đẩy trạng thái ticket có sẵn sang Phase kế tiếp trên
production, không dễ hoàn tác.

Có thể bỏ qua `--phase`/`--assignee` nếu đã điền `BLUEPRINT_PHASE`/
`BLUEPRINT_FULL_NAME` trong `.env` — khi đó chỉ cần chạy `run.bat`.

## Cài đặt / chạy thủ công (không dùng .bat, hoặc không phải Windows)

```
npm install
npx playwright install chromium
```

Copy `.env.example` thành `.env`, điền `BLUEPRINT_USERNAME`/`BLUEPRINT_PASSWORD`.
Tuỳ chọn (mỗi thiết bị/người dùng tự điền riêng):
- `BLUEPRINT_FULL_NAME=<tên hiển thị của bạn trên Blueprint>` — giá trị mặc
  định cho `--assignee` khi không truyền qua CLI (có thể để nhiều tên, phân
  cách bằng dấu phẩy).
- `BLUEPRINT_PHASE=<Confirmation|Solving|Finish>` — giá trị mặc định cho
  `--phase` khi không truyền qua CLI.

```
node scripts/smoke-test.js --phase Solving --assignee "<Tên Assignee>"
```

Search thử, chỉ in ra số ticket khớp + tóm tắt dòng đầu tiên, KHÔNG Submit gì
cả. Luôn chạy lệnh này trước để kiểm tra đúng Phase/Assignee cần xử lý.

```
node scripts/test-one-ticket.js --phase Solving --assignee "<Tên Assignee>"
```

Mở ticket đầu tiên khớp, bấm Submit, điền đúng nội dung theo Phase, rồi
**DỪNG LẠI TRƯỚC KHI BẤM OK** để tự kiểm tra trên trình duyệt. Muốn tự bấm OK
thật (submit thật, tab tự đóng): thêm `CONFIRM=yes` ở đầu dòng lệnh.

```
node index.js --phase Confirmation --assignee "<Tên Assignee>"
```

- `--phase`: 1 trong 3 giá trị `Confirmation`/`Solving`/`Finish`.
- `--assignee`: tên hiển thị đúng như trên Blueprint, có thể truyền nhiều
  người phân cách bằng dấu phẩy.
- `--max <N>`: tuỳ chọn, giới hạn số ticket tối đa xử lý trong 1 lần chạy.
- `--dry-run`: chỉ tìm + in ra ticket đầu tiên sẽ xử lý, KHÔNG Submit gì cả.
- `--yes`: bỏ qua bước xác nhận Enter trước khi bắt đầu (vd chạy tự động theo
  lịch, hoặc khi đã được `run.bat` tự hỏi xác nhận riêng).

Trước khi bắt đầu vòng lặp thật (không có `--dry-run`/`--yes`), tool dừng lại
chờ nhấn Enter xác nhận (in rõ Phase/Assignee đang dùng) — đọc kỹ dòng này
trước khi xác nhận.

Mỗi ticket: double-click mở Detail ở tab mới → bấm Submit → điền nội dung →
bấm OK → chờ tab tự đóng → quay lại tab danh sách, bấm Search lại (ticket vừa
xử lý sẽ biến mất khỏi kết quả vì đã đổi Phase) → lặp lại tới khi hết ticket
khớp. Nếu 1 ticket lỗi, tool bỏ qua và thử tiếp ticket kế tiếp — trừ khi gặp
đúng ticket vừa lỗi lần trước (dừng hẳn để tránh lặp vô hạn) hoặc trình duyệt
đã đóng.

## Việc còn thiếu

Xem [WORKFLOW.md](./WORKFLOW.md) mục 3 (hạn chế/rủi ro đã biết) và mục 4
(checklist tình trạng implement).
