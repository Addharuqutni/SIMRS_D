import { labOrders } from '../../db/schemas/clinical';
import { ROLE_GROUPS } from '../../utils/roles';
import { createOrdersRouter } from '../orders';

export const laboratoryRouter = createOrdersRouter(labOrders, ROLE_GROUPS.lab, 'LAB-', {
    hasilUrl: labOrders.hasilUrl,
    hasilTeks: labOrders.hasilTeks
}, 'hasilUrl');
