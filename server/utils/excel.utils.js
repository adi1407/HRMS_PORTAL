const ExcelJS = require('exceljs');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── Shared helpers ──────────────────────────────────────────── */
const applyBorder = (cell) => {
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFD0D0D0' } },
    left:   { style: 'thin', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    right:  { style: 'thin', color: { argb: 'FFD0D0D0' } },
  };
};

const styleHeaderRow = (row, bgArgb = 'FF1E40AF') => {
  row.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell);
  });
  row.height = 32;
};

const styleDataRow = (row, even) => {
  row.eachCell(cell => {
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.font      = { size: 9 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: even ? 'FFF8FAFF' : 'FFFFFFFF' } };
    applyBorder(cell);
  });
  row.height = 20;
};

/* ── Salary Excel ────────────────────────────────────────────── */
const buildSalaryExcel = (records, month, year) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HRMS System';
  wb.created  = new Date();

  const ws = wb.addWorksheet('Salary Report', { pageSetup: { orientation: 'landscape', fitToPage: true } });

  const COL_COUNT = 16;

  // ── Row 1: Title ──────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value     = 'HRMS — Monthly Salary Report';
  titleCell.font      = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  // ── Row 2: Period info ────────────────────────────────────────
  ws.mergeCells(2, 1, 2, COL_COUNT);
  const infoCell = ws.getCell('A2');
  infoCell.value     = `Period: ${MONTHS[month - 1]} ${year}   |   Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}   |   Total Employees: ${records.length}`;
  infoCell.font      = { italic: true, size: 10, color: { argb: 'FF374151' } };
  infoCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EFFF' } };
  infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // ── Row 3: Blank ──────────────────────────────────────────────
  ws.addRow([]);

  // ── Row 4: Headers ────────────────────────────────────────────
  const headers = [
    'S.No', 'Emp ID', 'Name', 'Department', 'Designation',
    'Gross (₹)', 'Full Days', 'Half Days', 'Absent', 'Paid Leave', 'Unpaid Leave',
    'Deduction Days', 'Deduction (₹)', 'Adjustment (₹)', 'Net Salary (₹)', 'Status',
  ];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, 'FF1E40AF');

  // ── Column widths ─────────────────────────────────────────────
  const colWidths = [6, 12, 22, 18, 18, 14, 10, 10, 8, 10, 12, 14, 14, 14, 16, 10];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── Data rows ─────────────────────────────────────────────────
  let totalGross = 0, totalDeduction = 0, totalNet = 0;

  records.forEach((r, idx) => {
    const adj = r.manualAdjustment || 0;
    totalGross     += r.grossSalary     || 0;
    totalDeduction += r.deductionAmount || 0;
    totalNet       += r.netSalary       || 0;

    const row = ws.addRow([
      idx + 1,
      r.employee?.employeeId || '—',
      r.employee?.name       || '—',
      r.employee?.department || '—',
      r.employee?.designation || '—',
      r.grossSalary     || 0,
      r.fullDays        || 0,
      (r.displayHalfDays || 0) + (r.realHalfDays || 0),
      r.absentDays      || 0,
      r.paidLeaves      || 0,
      r.unpaidLeaves    || 0,
      r.deductionDays   || 0,
      r.deductionAmount || 0,
      adj,
      r.netSalary       || 0,
      r.status,
    ]);

    styleDataRow(row, idx % 2 === 0);

    // Numeric formatting
    [6, 13, 14, 15].forEach(c => {
      row.getCell(c).numFmt = '₹#,##0.00';
    });

    // Deduction & adjustment in red if positive/negative
    const deductCell = row.getCell(13);
    if ((r.deductionAmount || 0) > 0) deductCell.font = { size: 9, color: { argb: 'FFDC2626' } };

    const adjCell = row.getCell(14);
    if (adj < 0) adjCell.font = { size: 9, color: { argb: 'FFDC2626' } };
    else if (adj > 0) adjCell.font = { size: 9, color: { argb: 'FF16A34A' } };

    // Net salary bold
    row.getCell(15).font = { bold: true, size: 9 };

    // Status badge color
    const statusCell = row.getCell(16);
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (r.status === 'FINAL') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { bold: true, color: { argb: 'FF16A34A' }, size: 9 };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      statusCell.font = { bold: true, color: { argb: 'FFD97706' }, size: 9 };
    }
  });

  // ── Summary row ───────────────────────────────────────────────
  ws.addRow([]);
  const sumRow = ws.addRow([
    '', '', '', '', 'TOTALS',
    totalGross, '', '', '', '', '',
    '', totalDeduction, '', totalNet, '',
  ]);
  sumRow.eachCell((cell, col) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } };
    cell.font      = { bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: col <= 5 ? 'right' : 'center' };
    applyBorder(cell);
  });
  [6, 13, 15].forEach(c => { sumRow.getCell(c).numFmt = '₹#,##0.00'; });
  sumRow.height = 22;

  // Freeze header rows
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

  return wb;
};

/* ── Attendance Excel ────────────────────────────────────────── */
const STATUS_FILLS = {
  FULL_DAY:    { bg: 'FFDCFCE7', fg: 'FF166534' },
  HALF_DAY:    { bg: 'FFFEF9C3', fg: 'FF854D0E' },
  ABSENT:      { bg: 'FFFEE2E2', fg: 'FF991B1B' },
  HOLIDAY:     { bg: 'FFFAF5FF', fg: 'FF6B21A8' },
  WEEKLY_OFF:  { bg: 'FFF3F4F6', fg: 'FF374151' },
  ON_LEAVE:    { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
};

const buildAttendanceExcel = (records, month, year) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HRMS System';
  wb.created  = new Date();

  const ws = wb.addWorksheet('Attendance Report', { pageSetup: { orientation: 'landscape', fitToPage: true } });

  const COL_COUNT = 11;

  // ── Group records by employee, sorted alphabetically ──────────
  const grouped = {};
  records.forEach(r => {
    const key = r.employee?._id?.toString() || 'unknown';
    if (!grouped[key]) grouped[key] = { employee: r.employee, records: [] };
    grouped[key].records.push(r);
  });
  const sortedGroups = Object.values(grouped).sort((a, b) =>
    (a.employee?.name || '').localeCompare(b.employee?.name || '')
  );
  sortedGroups.forEach(g => {
    g.records.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  const totalRecords = records.length;
  const totalEmps    = sortedGroups.length;

  // ── Row 1: Title ──────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = ws.getCell('A1');
  titleCell.value     = 'HRMS — Monthly Attendance Report';
  titleCell.font      = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  // ── Row 2: Period info ────────────────────────────────────────
  ws.mergeCells(2, 1, 2, COL_COUNT);
  const infoCell = ws.getCell('A2');
  infoCell.value     = `Period: ${MONTHS[month - 1]} ${year}   |   Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}   |   Total Records: ${totalRecords}   |   Employees: ${totalEmps}`;
  infoCell.font      = { italic: true, size: 10, color: { argb: 'FF1F2937' } };
  infoCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // ── Row 3: Blank ──────────────────────────────────────────────
  ws.addRow([]);

  // ── Row 4: Column headers ─────────────────────────────────────
  const headers = ['S.No', 'Employee ID', 'Name', 'Department', 'Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours', 'Notes'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, 'FF065F46');

  // ── Column widths ─────────────────────────────────────────────
  const colWidths = [6, 13, 22, 18, 14, 10, 14, 11, 11, 8, 30];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── Data rows grouped by employee ─────────────────────────────
  let globalIdx = 0;

  sortedGroups.forEach((group, groupIdx) => {
    const emp = group.employee || {};

    // ── Employee section header ──────────────────────────────────
    const currentRowNum = ws.rowCount + 1;
    ws.mergeCells(currentRowNum, 1, currentRowNum, COL_COUNT);
    const empHeaderCell = ws.getCell(currentRowNum, 1);
    empHeaderCell.value     = `  ${groupIdx + 1}.  ${emp.name || '—'}   |   ${emp.employeeId || '—'}   |   ${emp.department || '—'}   |   ${emp.designation || '—'}`;
    empHeaderCell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    empHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    empHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(currentRowNum).height = 24;

    // ── Attendance rows for this employee ────────────────────────
    let fullDays = 0, halfDays = 0, absentDays = 0, onLeave = 0, holidays = 0, weeklyOffs = 0;

    group.records.forEach((r, rowIdx) => {
      globalIdx++;
      const dateObj    = new Date(r.date);
      const dayName    = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
      const dateStr    = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const dispStatus = r.displayStatus || r.status || '—';

      // tally summary
      if (dispStatus === 'FULL_DAY')   fullDays++;
      else if (dispStatus === 'HALF_DAY') halfDays++;
      else if (dispStatus === 'ABSENT')   absentDays++;
      else if (dispStatus === 'ON_LEAVE') onLeave++;
      else if (dispStatus === 'HOLIDAY')  holidays++;
      else if (dispStatus === 'WEEKLY_OFF') weeklyOffs++;

      const row = ws.addRow([
        globalIdx,
        emp.employeeId || '—',
        emp.name       || '—',
        emp.department || '—',
        dateStr,
        dayName,
        dispStatus.replace(/_/g, ' '),
        r.checkInTime  || '—',
        r.checkOutTime || '—',
        r.workingHours > 0 ? `${r.workingHours}h` : '—',
        r.notes || '',
      ]);

      // Alternate light teal / white within each employee block
      styleDataRow(row, rowIdx % 2 === 0);

      // Status cell color
      const statusCell = row.getCell(7);
      const colors = STATUS_FILLS[dispStatus] || { bg: 'FFF3F4F6', fg: 'FF374151' };
      statusCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
      statusCell.font      = { bold: true, size: 9, color: { argb: colors.fg } };
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // ── Summary row for this employee ────────────────────────────
    const sumRowNum = ws.rowCount + 1;
    ws.mergeCells(sumRowNum, 1, sumRowNum, 4);
    const summaryLabel = ws.getCell(sumRowNum, 1);
    summaryLabel.value     = `  Summary — ${emp.name || '—'}`;
    summaryLabel.font      = { bold: true, size: 9, color: { argb: 'FF065F46' } };
    summaryLabel.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    summaryLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const summaryData = [
      `✅ Full: ${fullDays}`,
      `🟡 Half: ${halfDays}`,
      `❌ Absent: ${absentDays}`,
      `🔵 Leave: ${onLeave}`,
      `🟣 Holiday: ${holidays}`,
      `⬜ W/Off: ${weeklyOffs}`,
      '', '',
    ];
    summaryData.forEach((val, i) => {
      const cell = ws.getCell(sumRowNum, 5 + i);
      cell.value     = val;
      cell.font      = { size: 9, color: { argb: 'FF1F2937' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      applyBorder(cell);
    });
    applyBorder(summaryLabel);
    ws.getRow(sumRowNum).height = 20;

    // ── Spacer row between employees ─────────────────────────────
    ws.addRow([]);
  });

  // Freeze top 4 rows (title + info + blank + column headers)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

  return wb;
};

module.exports = { buildSalaryExcel, buildAttendanceExcel };
