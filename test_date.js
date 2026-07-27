import { parseISO, startOfDay } from 'date-fns';
const d = parseISO("2026-07-26");
console.log("parseISO:", d, d.toString());
const d2 = new Date("2026-07-26");
console.log("new Date():", d2, d2.toString());
