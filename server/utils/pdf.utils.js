const PDFDocument = require('pdfkit');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function line(doc, y) {
  doc.moveTo(50, y).lineTo(550, y).strokeColor('#e5e7eb').stroke();
}

function row(doc, label, value, y, bold = false) {
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(label, 55, y);
  doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111827').text(String(value ?? '—'), 300, y, { align: 'right', width: 240 });
}

// Generate a single salary slip section inside an existing PDF doc
function appendSalarySlip(doc, salary, index) {
  const emp = salary.employee || {};
  const isFirst = index === 0;
  if (!isFirst) doc.addPage();

  // Header
  doc.rect(50, 50, 500, 60).fill('#1e3a5f');
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text('SALARY SLIP', 55, 62);
  doc.fontSize(10).font('Helvetica').fillColor('#93c5fd')
    .text(`${MONTHS[(salary.month || 1) - 1]} ${salary.year}`, 55, 85);
  doc.fontSize(10).fillColor('#ffffff')
    .text(`Status: ${salary.status || 'DRAFT'}`, 0, 85, { align: 'right', width: 545 });

  let y = 130;

  // Employee details
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Employee Details', 55, y);
  y += 18; line(doc, y); y += 8;
  row(doc, 'Employee ID', emp.employeeId, y); y += 20;
  row(doc, 'Name', emp.name, y); y += 20;
  row(doc, 'Designation', emp.designation || '—', y); y += 20;
  row(doc, 'Working Days in Month', salary.daysInMonth, y); y += 20;

  y += 8; line(doc, y); y += 12;

  // Attendance
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Attendance Summary', 55, y);
  y += 18; line(doc, y); y += 8;
  row(doc, 'Full Days Present', salary.fullDays || 0, y); y += 20;
  row(doc, 'Half Days', (salary.realHalfDays || 0) + (salary.displayHalfDays || 0), y); y += 20;
  row(doc, 'Paid Leaves', salary.paidLeaves || 0, y); y += 20;
  row(doc, 'Absent Days', salary.absentDays || 0, y); y += 20;
  row(doc, 'Unpaid Leaves', salary.unpaidLeaves || 0, y); y += 20;
  row(doc, 'Holidays', salary.holidays || 0, y); y += 20;

  y += 8; line(doc, y); y += 12;

  // Salary Calculation
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Salary Calculation', 55, y);
  y += 18; line(doc, y); y += 8;
  row(doc, 'Gross Salary', `Rs ${(salary.grossSalary || 0).toLocaleString('en-IN')}`, y); y += 20;
  row(doc, 'Per Day Salary', `Rs ${(salary.perDaySalary || 0).toFixed(2)}`, y); y += 20;

  if (salary.hasDeduction) {
    row(doc, 'Deduction Days', salary.deductionDays || 0, y); y += 20;
    row(doc, 'Deduction Amount', `- Rs ${(salary.deductionAmount || 0).toLocaleString('en-IN')}`, y); y += 20;
  }
  if (salary.manualAdjustment) {
    const adj = salary.manualAdjustment;
    row(doc, `Adjustment (${salary.adjustmentNote || ''})`, `${adj >= 0 ? '+' : ''}Rs ${Math.abs(adj).toLocaleString('en-IN')}`, y); y += 20;
  }

  y += 4;
  doc.rect(50, y, 500, 32).fill('#f0fdf4');
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#15803d')
    .text('NET SALARY', 55, y + 9)
    .text(`Rs ${(salary.netSalary || 0).toLocaleString('en-IN')}`, 0, y + 9, { align: 'right', width: 545 });

  y += 50;
  doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
    .text('This is a computer-generated salary slip and does not require a signature.', 55, y, { align: 'center', width: 490 });
}

// Generate combined PDF: experience letter + last 2 salary slips
const generateResignationPDF = (resignation, salaries) => {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({ margin: 50, size: 'A4' });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const emp         = resignation.employee || {};
    const approvedDate = resignation.headReviewedAt ? new Date(resignation.headReviewedAt) : new Date();
    const joiningDate  = emp.joiningDate ? new Date(emp.joiningDate) : null;

    // ─── Page 1: Experience Letter ───────────────────────────────────────────
    doc.rect(50, 50, 500, 70).fill('#1e3a5f');
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff').text('EXPERIENCE LETTER', 55, 65, { align: 'center', width: 490 });
    doc.fontSize(10).font('Helvetica').fillColor('#93c5fd').text('Human Resource Management System', 55, 90, { align: 'center', width: 490 });

    let y = 145;
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(`Date: ${approvedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 55, y);

    y += 30;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('To Whom It May Concern,', 55, y);

    y += 24;
    const joinStr = joiningDate
      ? joiningDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'the date of joining';
    const leaveStr = (resignation.lastWorkingDate ? new Date(resignation.lastWorkingDate) : approvedDate)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    // Calculate experience
    let expText = '';
    if (joiningDate) {
      const diffMs    = approvedDate - joiningDate;
      const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const years     = Math.floor(totalDays / 365);
      const months    = Math.floor((totalDays % 365) / 30);
      expText = years > 0
        ? `${years} year${years > 1 ? 's' : ''}${months > 0 ? ` and ${months} month${months > 1 ? 's' : ''}` : ''}`
        : `${months} month${months > 1 ? 's' : ''}`;
    }

    const body = `This is to certify that ${emp.name || 'the employee'} (Employee ID: ${emp.employeeId || '—'}) has been a valued member of our organization, serving as ${emp.designation || 'an employee'} from ${joinStr} to ${leaveStr}.${expText ? ` During this tenure of ${expText}, they have demonstrated dedication, professionalism, and commitment to their responsibilities.` : ''}\n\nTheir resignation has been accepted and processed with effect from ${leaveStr}. We wish them the very best in their future endeavors.\n\nThis letter is issued upon request for whatever purpose it may serve.`;

    doc.fontSize(11).font('Helvetica').fillColor('#374151').text(body, 55, y, { width: 490, lineGap: 4 });

    y = doc.y + 40;
    line(doc, y); y += 16;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Authorized Signatory', 55, y);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('Human Resources Department', 55, y + 16);

    // ─── Page 2+: Salary Slips ───────────────────────────────────────────────
    if (salaries && salaries.length > 0) {
      salaries.forEach((s, i) => {
        doc.addPage();
        appendSalarySlip(doc, s, 0); // 0 so it always uses top of page
      });
    } else {
      doc.addPage();
      doc.fontSize(14).font('Helvetica').fillColor('#6b7280')
        .text('No salary slips found for the last 2 months.', 55, 200, { align: 'center', width: 490 });
    }

    doc.end();
  });
};

// Generate standalone salary slip PDF
const generateSalarySlipPDF = (salary) => {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({ margin: 50, size: 'A4' });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);
    appendSalarySlip(doc, salary, 0);
    doc.end();
  });
};

const STATUS_LABELS = { COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked' };
const STATUS_COLORS_PDF = { COMPLETED: '#15803d', IN_PROGRESS: '#b45309', BLOCKED: '#b91c1c' };

const generateMonthlyTaskPDF = (employee, entries, month, year) => {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({ margin: 50, size: 'A4' });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    // Header
    doc.rect(50, 50, 500, 70).fill('#1e3a5f');
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
      .text('MONTHLY TASK REPORT', 55, 62, { align: 'center', width: 490 });
    doc.fontSize(10).font('Helvetica').fillColor('#93c5fd')
      .text(`${MONTHS[month - 1]} ${year}`, 55, 88, { align: 'center', width: 490 });

    let y = 140;

    // Employee info
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Employee Details', 55, y);
    y += 18; line(doc, y); y += 8;
    row(doc, 'Employee ID', employee.employeeId, y); y += 20;
    row(doc, 'Name', employee.name, y); y += 20;
    row(doc, 'Designation', employee.designation || '—', y); y += 20;
    row(doc, 'Department', employee.department?.name || '—', y); y += 20;

    // Summary
    const totalTasks = entries.reduce((sum, e) => sum + e.tasks.length, 0);
    const completed = entries.reduce((sum, e) => sum + e.tasks.filter(t => t.status === 'COMPLETED').length, 0);
    row(doc, 'Days Reported', entries.length, y); y += 20;
    row(doc, 'Total Tasks', totalTasks, y); y += 20;
    row(doc, 'Completed Tasks', completed, y); y += 20;

    y += 8; line(doc, y); y += 16;

    // Daily entries
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Daily Task Entries', 55, y);
    y += 20;

    if (entries.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
        .text('No task entries found for this month.', 55, y);
    } else {
      for (const entry of entries) {
        if (y > 700) { doc.addPage(); y = 50; }

        const dateStr = new Date(entry.date).toLocaleDateString('en-IN', {
          weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        });

        doc.rect(50, y, 500, 22).fill('#f0f4ff');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f')
          .text(dateStr, 55, y + 6);
        doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
          .text(`${entry.tasks.length} task${entry.tasks.length > 1 ? 's' : ''}`, 0, y + 6, { align: 'right', width: 545 });
        y += 28;

        for (const task of entry.tasks) {
          if (y > 720) { doc.addPage(); y = 50; }

          const statusColor = STATUS_COLORS_PDF[task.status] || '#374151';
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
            .text(`• ${task.title}`, 65, y, { width: 380, continued: false });

          doc.fontSize(8).font('Helvetica-Bold').fillColor(statusColor)
            .text(STATUS_LABELS[task.status] || task.status, 460, y, { width: 90, align: 'right' });

          y = Math.max(doc.y, y + 14);

          if (task.description) {
            doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
              .text(task.description, 75, y, { width: 420 });
            y = doc.y + 4;
          }
          y += 4;
        }
        y += 6;
      }
    }

    // Footer
    y = Math.max(y, doc.y) + 20;
    if (y > 740) { doc.addPage(); y = 50; }
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 55, y, { align: 'center', width: 490 });

    doc.end();
  });
};

module.exports = { generateResignationPDF, generateSalarySlipPDF, generateMonthlyTaskPDF };
