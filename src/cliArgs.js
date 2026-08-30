// Parse chung cho `--phase`/`--assignee` (dùng ở cả index.js và 2 script
// trong scripts/) — 1 nơi duy nhất giữ logic "token kế tiếp có phải giá trị
// hợp lệ không", tránh 3 bản copy tự trôi lệch nhau.

/**
 * Token kế tiếp `argv[i+1]` có phải giá trị hợp lệ cho cờ ở vị trí `i`
 * không — tồn tại và không phải bắt đầu bằng `--` (tức không phải chính 1 cờ
 * khác). Export riêng để index.js dùng LẠI đúng guard này cho `--max`, thay
 * vì viết lại 1 bản y hệt.
 */
function hasValueAt(argv, i) {
  return i + 1 < argv.length && !String(argv[i + 1]).startsWith('--');
}

function parseCommonArgs(argv) {
  const args = { assignees: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--phase') { if (hasValueAt(argv, i)) args.phase = argv[++i]; }
    else if (a === '--assignee' || a === '--assignees') {
      if (hasValueAt(argv, i)) {
        args.assignees.push(
          ...argv[++i]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }
    }
  }
  return args;
}

module.exports = { parseCommonArgs, hasValueAt };
