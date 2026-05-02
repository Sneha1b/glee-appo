import type { TestSuite } from "./runner";
import { formatSuite } from "./suites/format";
import { utilsSuite } from "./suites/utils";
import { slotsUnitSuite } from "./suites/slots-unit";
import { slotsIntegrationSuite } from "./suites/slots-integration";
import { bookingFlowSuite } from "./suites/booking-flow";
import { authContextSuite } from "./suites/auth-context";
import { useMobileSuite } from "./suites/use-mobile";

export const ALL_SUITES: TestSuite[] = [
  // Unit suites first (fast, no async dependencies)
  formatSuite,
  utilsSuite,
  slotsUnitSuite,
  authContextSuite,
  useMobileSuite,
  // Integration suites
  slotsIntegrationSuite,
  bookingFlowSuite,
];

export { formatSuite, utilsSuite, slotsUnitSuite, slotsIntegrationSuite, bookingFlowSuite, authContextSuite, useMobileSuite };
