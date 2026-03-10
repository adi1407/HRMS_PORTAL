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

const RATING_LABELS = {
  OUTSTANDING: 'Outstanding',
  EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
  MEETS_EXPECTATIONS: 'Meets Expectations',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  UNSATISFACTORY: 'Unsatisfactory',
};

const generateAppraisalLetterPDF = (appraisal) => {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({ margin: 50, size: 'A4' });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const emp = appraisal.employee || {};
    const reviewer = appraisal.reviewer || {};
    const periodStart = appraisal.period?.startDate
      ? new Date(appraisal.period.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    const periodEnd = appraisal.period?.endDate
      ? new Date(appraisal.period.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

    // Header
    doc.rect(50, 50, 500, 70).fill('#1e3a5f');
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
      .text('PERFORMANCE APPRAISAL LETTER', 55, 62, { align: 'center', width: 490 });
    doc.fontSize(10).font('Helvetica').fillColor('#93c5fd')
      .text(`${appraisal.cycleName} — ${appraisal.cycleType.replace(/_/g, ' ')}`, 55, 88, { align: 'center', width: 490 });

    let y = 145;

    // Date
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 55, y);
    y += 28;

    // Employee details
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Employee Details', 55, y);
    y += 18; line(doc, y); y += 8;
    row(doc, 'Employee ID', emp.employeeId, y); y += 20;
    row(doc, 'Name', emp.name, y); y += 20;
    row(doc, 'Designation', emp.designation || '—', y); y += 20;
    row(doc, 'Review Period', `${periodStart} to ${periodEnd}`, y); y += 20;
    row(doc, 'Reviewer', reviewer.name || '—', y); y += 20;

    y += 8; line(doc, y); y += 16;

    // KPI Table
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('KPI Scores', 55, y);
    y += 20;

    // Table header
    doc.rect(50, y, 500, 22).fill('#f0f4ff');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e3a5f');
    doc.text('KPI', 55, y + 6, { width: 200 });
    doc.text('Weight', 260, y + 6, { width: 50, align: 'center' });
    doc.text('Self', 315, y + 6, { width: 50, align: 'center' });
    doc.text('Manager', 370, y + 6, { width: 55, align: 'center' });
    doc.text('Weighted', 430, y + 6, { width: 70, align: 'center' });
    y += 26;

    for (const kpi of (appraisal.kpis || [])) {
      if (y > 700) { doc.addPage(); y = 50; }
      const wScore = kpi.managerScore != null
        ? ((kpi.managerScore * kpi.weight) / 100).toFixed(2)
        : '—';
      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      doc.text(kpi.title, 55, y, { width: 200 });
      doc.text(`${kpi.weight}%`, 260, y, { width: 50, align: 'center' });
      doc.text(kpi.selfScore != null ? `${kpi.selfScore}/5` : '—', 315, y, { width: 50, align: 'center' });
      doc.text(kpi.managerScore != null ? `${kpi.managerScore}/5` : '—', 370, y, { width: 55, align: 'center' });
      doc.text(wScore, 430, y, { width: 70, align: 'center' });
      y += 18;
    }

    y += 8; line(doc, y); y += 12;

    // Final scores
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Final Assessment', 55, y);
    y += 18; line(doc, y); y += 8;
    row(doc, 'Self Assessment Score', appraisal.weightedSelfScore != null ? `${appraisal.weightedSelfScore}/5` : '—', y); y += 20;
    row(doc, 'Manager Assessment Score', appraisal.weightedManagerScore != null ? `${appraisal.weightedManagerScore}/5` : '—', y); y += 20;

    // Rating box
    y += 4;
    const ratingColor = appraisal.rating === 'OUTSTANDING' ? '#15803d'
      : appraisal.rating === 'EXCEEDS_EXPECTATIONS' ? '#2563eb'
      : appraisal.rating === 'MEETS_EXPECTATIONS' ? '#b45309'
      : '#b91c1c';
    const ratingBg = appraisal.rating === 'OUTSTANDING' ? '#f0fdf4'
      : appraisal.rating === 'EXCEEDS_EXPECTATIONS' ? '#eff6ff'
      : appraisal.rating === 'MEETS_EXPECTATIONS' ? '#fffbeb'
      : '#fef2f2';

    doc.rect(50, y, 500, 36).fill(ratingBg);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(ratingColor)
      .text('FINAL SCORE', 55, y + 10)
      .text(`${appraisal.finalScore != null ? appraisal.finalScore : '—'}/5 — ${RATING_LABELS[appraisal.rating] || '—'}`, 0, y + 10, { align: 'right', width: 545 });
    y += 48;

    // Manager comment
    if (appraisal.overallManagerComment) {
      if (y > 660) { doc.addPage(); y = 50; }
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('Manager Comments', 55, y);
      y += 16;
      doc.fontSize(9).font('Helvetica').fillColor('#374151')
        .text(appraisal.overallManagerComment, 55, y, { width: 490, lineGap: 3 });
      y = doc.y + 16;
    }

    // Footer
    if (y > 720) { doc.addPage(); y = 50; }
    y += 20;
    line(doc, y); y += 16;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Authorized Signatory', 55, y);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('Human Resources Department', 55, y + 16);

    y += 40;
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text('This is a computer-generated appraisal letter.', 55, y, { align: 'center', width: 490 });

    doc.end();
  });
};

module.exports = { generateResignationPDF, generateSalarySlipPDF, generateMonthlyTaskPDF, generateAppraisalLetterPDF };
