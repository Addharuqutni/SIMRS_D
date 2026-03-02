CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"unit" varchar(100),
	"status" varchar(20) DEFAULT 'aktif' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_items" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_id" text NOT NULL,
	"kategori" varchar(100) NOT NULL,
	"nama_item" text NOT NULL,
	"harga" integer NOT NULL,
	"jumlah" integer DEFAULT 1 NOT NULL,
	"subtotal" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billings" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"no_billing" varchar(50) NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"waktu_finalisasi" timestamp,
	"waktu_bayar" timestamp,
	"metode_pembayaran" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billings_no_billing_unique" UNIQUE("no_billing")
);
--> statement-breakpoint
CREATE TABLE "bpjs_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"sep_id" text NOT NULL,
	"ina_cbg" varchar(50),
	"tarif_rs" integer NOT NULL,
	"tarif_inacbg" integer,
	"status" varchar(50) DEFAULT 'dibentuk' NOT NULL,
	"waktu_klaim" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"keterangan" text NOT NULL,
	"kategori" varchar(100) NOT NULL,
	"jenis" varchar(50) NOT NULL,
	"jumlah" integer NOT NULL,
	"tanggal" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emr_soap" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"dokter_id" text NOT NULL,
	"subjektif" text,
	"objektif" text,
	"asesmen" text,
	"planning" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "igd_triase" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"triase" varchar(20) NOT NULL,
	"keluhan_utama" text NOT NULL,
	"tensi" varchar(20),
	"nadi" varchar(20),
	"suhu" real,
	"pernapasan" varchar(20),
	"kesadaran" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rawat_inap_admisi" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"ruangan_id" text NOT NULL,
	"kelas" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'dirawat' NOT NULL,
	"waktu_masuk" timestamp DEFAULT now() NOT NULL,
	"waktu_keluar" timestamp
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"rm" varchar(20) NOT NULL,
	"nik" varchar(16),
	"nama" text NOT NULL,
	"tempat_lahir" text,
	"tanggal_lahir" date,
	"gender" varchar(20),
	"goldar" varchar(5),
	"agama" varchar(50),
	"alamat" text,
	"telepon" varchar(20),
	"pekerjaan" varchar(100),
	"alergi" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_rm_unique" UNIQUE("rm"),
	CONSTRAINT "patients_nik_unique" UNIQUE("nik")
);
--> statement-breakpoint
CREATE TABLE "sep_records" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"no_sep" varchar(50) NOT NULL,
	"no_kartu" varchar(50) NOT NULL,
	"diagnosa" text NOT NULL,
	"tgl_sep" date NOT NULL,
	"ppk_rujukan" text,
	"status" varchar(50) DEFAULT 'aktif' NOT NULL,
	CONSTRAINT "sep_records_no_sep_unique" UNIQUE("no_sep")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"poli_id" text NOT NULL,
	"dokter_id" text NOT NULL,
	"jaminan" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'menunggu' NOT NULL,
	"tipe_kunjungan" varchar(50) NOT NULL,
	"waktu_daftar" timestamp DEFAULT now() NOT NULL,
	"waktu_selesai" timestamp
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"no_order" varchar(50) NOT NULL,
	"visit_id" text NOT NULL,
	"dokter_id" text,
	"pemeriksaan" text NOT NULL,
	"status" varchar(50) DEFAULT 'baru' NOT NULL,
	"hasil" text,
	"nilai_normal" text,
	"waktu_order" timestamp DEFAULT now() NOT NULL,
	"waktu_selesai" timestamp,
	CONSTRAINT "lab_orders_no_order_unique" UNIQUE("no_order")
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" text PRIMARY KEY NOT NULL,
	"prescription_id" text NOT NULL,
	"obat_id" text NOT NULL,
	"dosis" varchar(100) NOT NULL,
	"jumlah" integer NOT NULL,
	"keterangan" text
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"no_resep" varchar(50) NOT NULL,
	"visit_id" text NOT NULL,
	"dokter_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'baru' NOT NULL,
	"waktu_resep" timestamp DEFAULT now() NOT NULL,
	"waktu_selesai" timestamp,
	CONSTRAINT "prescriptions_no_resep_unique" UNIQUE("no_resep")
);
--> statement-breakpoint
CREATE TABLE "rad_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"no_order" varchar(50) NOT NULL,
	"visit_id" text NOT NULL,
	"dokter_id" text,
	"pemeriksaan" text NOT NULL,
	"status" varchar(50) DEFAULT 'baru' NOT NULL,
	"expertise" text,
	"waktu_order" timestamp DEFAULT now() NOT NULL,
	"waktu_selesai" timestamp,
	CONSTRAINT "rad_orders_no_order_unique" UNIQUE("no_order")
);
--> statement-breakpoint
CREATE TABLE "doctor_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"poli_id" varchar(50) NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"quota" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"poli_id" varchar(50) NOT NULL,
	"queue_number" integer NOT NULL,
	"queue_code" varchar(10),
	"status" varchar(20) DEFAULT 'menunggu' NOT NULL,
	"loket" varchar(20),
	"called_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode_obat" varchar(50) NOT NULL,
	"nama" varchar(200) NOT NULL,
	"kategori" varchar(100),
	"satuan" varchar(50),
	"harga_beli" integer DEFAULT 0 NOT NULL,
	"harga_jual" integer DEFAULT 0 NOT NULL,
	"min_stok" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medicines_kode_obat_unique" UNIQUE("kode_obat")
);
--> statement-breakpoint
CREATE TABLE "stock_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicine_id" integer NOT NULL,
	"no_batch" varchar(100) NOT NULL,
	"expired_date" date NOT NULL,
	"qty_masuk" integer NOT NULL,
	"qty_sisa" integer NOT NULL,
	"supplier" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_mutations" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicine_id" integer NOT NULL,
	"batch_id" integer,
	"jenis" varchar(20) NOT NULL,
	"qty" integer NOT NULL,
	"keterangan" text,
	"referensi" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(20) DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"link_url" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_billing_id_billings_id_fk" FOREIGN KEY ("billing_id") REFERENCES "public"."billings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_sep_id_sep_records_id_fk" FOREIGN KEY ("sep_id") REFERENCES "public"."sep_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emr_soap" ADD CONSTRAINT "emr_soap_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "igd_triase" ADD CONSTRAINT "igd_triase_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawat_inap_admisi" ADD CONSTRAINT "rawat_inap_admisi_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sep_records" ADD CONSTRAINT "sep_records_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rad_orders" ADD CONSTRAINT "rad_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;