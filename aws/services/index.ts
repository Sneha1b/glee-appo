// Explicit re-exports to avoid duplicate-name ambiguity between
// staff.ts vs staffServices.ts and role.ts vs users.ts.
export * from "./bookings";
export * from "./businesses";
export * from "./businessHours";
export * from "./closures";
export * from "./invoices";
export * from "./metrics";
export * from "./profiles";
export * from "./services";
export * from "./slots";
export * from "./timeBlocks";

// staff.ts has the canonical staff CRUD + availabilities + staffServices.
export {
  listStaffByBusiness,
  createStaff,
  deleteStaff,
  listStaffServiceLinks,
  assignServiceToStaff,
  removeServiceFromStaff,
  listAvailabilities,
  replaceAvailabilityForWeekday,
} from "./staff";

// users.ts owns AppRole; role.ts re-exports the same type.
export { type AppRole, getUserByCognitoSub, upsertUserFromCognito } from "./users";
export {
  getUserRole,
  getUserRoleByCognitoSub,
  setUserRole,
  setUserRoleByCognitoSub,
} from "./role";
