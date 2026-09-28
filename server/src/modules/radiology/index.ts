import { createPenunjangRouter } from '../penunjang/routes';

// Radiology (RIS) worklist — orders, expertise and hasil PDFs. Rules live in
// modules/penunjang/orders.ts; this file only binds the unit's routes.
export const radiologyRouter = createPenunjangRouter('radiologi');
