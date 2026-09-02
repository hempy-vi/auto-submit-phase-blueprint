// Parse chung cho `--phase`/`--assignee` (dùng ở cả index.js và 2 script
// trong scripts/) — 1 nơi duy nhất giữ logic "token kế tiếp có phải giá trị
// hợp lệ không", tránh 3 bản copy tự trôi lệch nhau.

/**
 * Token kế tiếp `argv[i+1]` có phải giá trị hợp lệ cho cờ ở vị trí `i`
 * không — phải tồn tại, không rỗng/toàn khoảng trắng, và không bắt đầu bằng
 * `--` (tức không phải chính 1 cờ khác bị "nuốt" nhầm làm giá trị). Export
 * riêng để index.js dùng LẠI đúng guard này cho `--max`, thay vì viết lại 1
 * bản y hệt.
 */
function hasValueAt(argv, i) {
  const v = argv[i + 1];
  return v !== undefined && v.trim() !== '' && !v.startsWith('--');
}

/**
 * ⚠️ Cố ý NÉM LỖI (không âm thầm bỏ qua) khi `--phase`/`--assignee` xuất hiện
 * nhưng thiếu giá trị hợp lệ theo sau — vd gõ nhầm `--phase --assignee "X"`
 * (quên giá trị Phase). Vì `run.bat` giờ chạy Submit thật ngay không hỏi xác
 * nhận, im lặng rơi về giá trị mặc định trong `.env` (khác hẳn ý người dùng
 * gõ) là hành vi nguy hiểm hơn nhiều so với dừng lại báo lỗi rõ ràng.
 */
function parseCommonArgs(argv) {
  const args = { assignees: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--phase') {
      if (!hasValueAt(argv, i)) throw new Error('Thiếu giá trị cho --phase (đứng cuối dòng lệnh, hoặc bị 1 cờ khác đứng ngay sau "nuốt" mất).');
      args.phase = argv[++i];
    } else if (a === '--assignee' || a === '--assignees') {
      if (!hasValueAt(argv, i)) throw new Error(`Thiếu giá trị cho ${a} (đứng cuối dòng lệnh, hoặc bị 1 cờ khác đứng ngay sau "nuốt" mất).`);
      args.assignees.push(
        ...argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return args;
}

module.exports = { parseCommonArgs, hasValueAt };
