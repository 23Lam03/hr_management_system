// Barrel file for models. Importing models from this single entry point
// ensures that:
// 1. Mongoose has all models registered before any populate() runs.
// 2. Cross-references (Employee ↔ User ↔ Department ↔ Position ↔ Attendance ↔ LeaveRequest) work
//    even if individual files are loaded in any order.
// 3. Test scripts and the future seed/CLI can import one module.

import User from './user.model.js';
import Employee from './employee.model.js';
import Department from './department.model.js';
import Position from './position.model.js';
import Attendance from './attendance.model.js';
import LeaveRequest from './leaveRequest.model.js';
import Payroll from './payroll.model.js';
import AuditLog from './auditLog.model.js';
import Notification from './notification.model.js';
import Session from './session.model.js';

export {
  User,
  Employee,
  Department,
  Position,
  Attendance,
  LeaveRequest,
  Payroll,
  AuditLog,
  Notification,
  Session,
};

// Side-effect import: ensures populate('ref') on each model can find
// the referenced model via mongoose.model(name).
export default {
  User,
  Employee,
  Department,
  Position,
  Attendance,
  LeaveRequest,
  Payroll,
  AuditLog,
  Notification,
  Session,
};