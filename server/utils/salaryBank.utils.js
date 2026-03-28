/**
 * Accounts may enter salary & bank details only for the **initial** setup per employee.
 * After that, only Director / Super Admin may change them directly; Accounts must use salary-requests.
 */

function hasSalaryBankData(user) {
  const g = Number(user.grossSalary);
  const bank = String(user.bankAccountNumber || '').trim();
  const ifsc = String(user.ifscCode || '').trim();
  return (g > 0 && !Number.isNaN(g)) || bank !== '' || ifsc !== '';
}

/**
 * When true, ACCOUNTS role must not PATCH salary/bank directly (use salary-requests workflow).
 * DIRECTOR and SUPER_ADMIN are never blocked.
 */
function isSalaryBankLockedForAccounts(user) {
  if (!user) return true;
  if (user.salaryBankInitialCaptureDone === true) return true;
  if (user.salaryBankInitialCaptureDone === false) return false;
  // Legacy documents without the flag: treat as "already captured" if any data exists
  return hasSalaryBankData(user);
}

/**
 * After Accounts (or salary-request first-time apply) saves initial details, call this merge.
 */
function markSalaryBankInitialCaptureIfNeeded(updates, existingUser) {
  const merged = {
    grossSalary: updates.grossSalary !== undefined ? updates.grossSalary : existingUser.grossSalary,
    bankAccountNumber: updates.bankAccountNumber !== undefined ? updates.bankAccountNumber : existingUser.bankAccountNumber,
    ifscCode: updates.ifscCode !== undefined ? updates.ifscCode : existingUser.ifscCode,
  };
  if (hasSalaryBankData(merged) && existingUser.salaryBankInitialCaptureDone !== true) {
    return { ...updates, salaryBankInitialCaptureDone: true };
  }
  return updates;
}

module.exports = {
  hasSalaryBankData,
  isSalaryBankLockedForAccounts,
  markSalaryBankInitialCaptureIfNeeded,
};
