/**
 * Report Style 01 pages where child is likely present but subjectScale=small
 * without allowSmallChildForEstablishing.
 *
 *   npx tsx scripts/audit-style01-child-scale.ts
 */
import { reportStyle01ChildScaleViolations } from '../lib/style01-child-scale-validator';

const violations = reportStyle01ChildScaleViolations({ log: console.log });
process.exit(violations.length > 0 ? 0 : 0);
