import { UserTable } from '../pengaturan/UserTable';
import { DOCTOR_ROLES } from '../../../shared/access';
import styles from '../registrasi/registrasi.module.css';

/** Daftar dokter aktif — the same CRUD screen as Manajemen User, restricted to doctor roles. */
export function ListDokter() {
    return (
        <div className={styles.page}>
            <UserTable title="Daftar Dokter" queryKey="master-doctors" allowedRoles={DOCTOR_ROLES} doctorsOnly />
        </div>
    );
}
