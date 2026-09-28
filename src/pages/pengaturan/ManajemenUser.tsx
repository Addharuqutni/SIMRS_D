import { UserTable } from './UserTable';
import styles from '../registrasi/registrasi.module.css';

/** Admin CRUD over system users. Audit trail lives on its own page (/audit-trail). */
export function ManajemenUser() {
    return (
        <div className={styles.page}>
            <UserTable title="Manajemen User & Akses" queryKey="master-users" />
        </div>
    );
}
