# Salary & bank details — roles

| Role | First-time setup (no initial capture on file) | After initial capture |
|------|-----------------------------------------------|------------------------|
| **Accounts** | Can set gross salary, bank account, IFSC, Managing Head via **Employees** or PATCH `PATCH /api/users/:id` | Cannot PATCH directly. Must submit **`POST /api/salary-requests`** (Director / Super Admin approval). |
| **Director** | Can set at **create** or **edit** | Can always edit directly. |
| **Super Admin** | Same as Director | Same as Director. |
| **HR** | Cannot set salary/bank fields | Cannot set salary/bank fields |

The field **`salaryBankInitialCaptureDone`** on the user marks that initial salary/bank data exists. Older records without this field are treated as “already captured” if they have gross salary &gt; 0 or bank/IFSC data.

**Approve requests:** `PATCH /api/salary-requests/:id/review` — **Director** or **Super Admin** only.
