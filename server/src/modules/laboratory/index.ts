import { createPenunjangRouter } from '../penunjang/routes';

// Laboratory (LIS) worklist — orders, results and hasil PDFs. Rules live in
// modules/penunjang/orders.ts; this file only binds the unit's routes.
export const laboratoryRouter = createPenunjangRouter('lab');
