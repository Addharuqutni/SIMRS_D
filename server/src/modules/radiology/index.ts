import { radiologyOrders } from '../../db/schemas/clinical';
import { ROLE_GROUPS } from '../../utils/roles';
import { createOrdersRouter } from '../orders';

export const radiologyRouter = createOrdersRouter(radiologyOrders, ROLE_GROUPS.lab, 'RAD-', {
    hasilDicomUrl: radiologyOrders.hasilDicomUrl,
    expertise: radiologyOrders.expertise
}, 'hasilDicomUrl');
