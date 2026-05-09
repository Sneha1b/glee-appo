CREATE TABLE `availabilities` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`staff_id` char(36) NOT NULL,
	`weekday` tinyint NOT NULL,
	`start_minute` int NOT NULL,
	`end_minute` int NOT NULL,
	CONSTRAINT `availabilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`service_id` char(36) NOT NULL,
	`staff_id` char(36) NOT NULL,
	`customer_name` varchar(240) NOT NULL,
	`customer_email` varchar(320) NOT NULL,
	`customer_phone` varchar(40),
	`start_at` timestamp(3) NOT NULL,
	`end_at` timestamp(3) NOT NULL,
	`status` enum('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_closures` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`from_date` varchar(10) NOT NULL,
	`to_date` varchar(10) NOT NULL,
	`reason` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_closures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_hours` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`weekday` tinyint NOT NULL,
	`open_minute` int NOT NULL,
	`close_minute` int NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_hours_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_invites` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`invited_by` char(36) NOT NULL,
	`accepted_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_invites_uq` UNIQUE(`business_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `business_owners` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`business_id` char(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_owners_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_owners_uq` UNIQUE(`user_id`,`business_id`)
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(240) NOT NULL,
	`category` varchar(120),
	`description` text,
	`phone` varchar(40),
	`address_line1` varchar(240),
	`address_line2` varchar(240),
	`city` varchar(120),
	`region` varchar(120),
	`postal_code` varchar(40),
	`country` varchar(80),
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`logo_url` text,
	`banner_url` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`full_name` varchar(240) NOT NULL,
	`first_name` varchar(120),
	`last_name` varchar(120),
	`phone` varchar(40),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`invoice_number` varchar(64) NOT NULL,
	`business_id` char(36) NOT NULL,
	`booking_id` char(36) NOT NULL,
	`staff_id` char(36),
	`service_id` char(36),
	`service_name` varchar(240) NOT NULL,
	`staff_name` varchar(240),
	`customer_name` varchar(240) NOT NULL,
	`customer_email` varchar(320) NOT NULL,
	`customer_phone` varchar(40),
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`tax` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` varchar(32) NOT NULL DEFAULT 'issued',
	`appointment_at` timestamp(3) NOT NULL,
	`issued_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` timestamp(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3) + INTERVAL 18 MONTH),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoice_number_unique` UNIQUE(`invoice_number`),
	CONSTRAINT `invoices_booking_id_unique` UNIQUE(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `provider_profiles` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`first_name` varchar(120) NOT NULL,
	`last_name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `provider_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`name` varchar(240) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `service_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`category_id` char(36),
	`name` varchar(240) NOT NULL,
	`description` text,
	`duration_min` int NOT NULL,
	`price` decimal(12,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`available_from` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slot_locks` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`holder_session_id` varchar(64) NOT NULL,
	`staff_id` char(36) NOT NULL,
	`service_id` char(36) NOT NULL,
	`start_at` timestamp(3) NOT NULL,
	`end_at` timestamp(3) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `slot_locks_id` PRIMARY KEY(`id`),
	CONSTRAINT `slot_locks_staff_start_uq` UNIQUE(`staff_id`,`start_at`)
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`business_id` char(36) NOT NULL,
	`name` varchar(240) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_services` (
	`staff_id` char(36) NOT NULL,
	`service_id` char(36) NOT NULL,
	CONSTRAINT `staff_services_staff_id_service_id_pk` PRIMARY KEY(`staff_id`,`service_id`)
);
--> statement-breakpoint
CREATE TABLE `time_blocks` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`staff_id` char(36) NOT NULL,
	`start_at` timestamp(3) NOT NULL,
	`end_at` timestamp(3) NOT NULL,
	`reason` text,
	CONSTRAINT `time_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`role` enum('customer','provider') NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_user_role_uq` UNIQUE(`user_id`,`role`)
);
--> statement-breakpoint
CREATE INDEX `availabilities_staff_idx` ON `availabilities` (`staff_id`);--> statement-breakpoint
CREATE INDEX `bookings_staff_start_idx` ON `bookings` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `bookings_business_idx` ON `bookings` (`business_id`);--> statement-breakpoint
CREATE INDEX `business_hours_business_idx` ON `business_hours` (`business_id`);--> statement-breakpoint
CREATE INDEX `business_invites_email_idx` ON `business_invites` (`email`);--> statement-breakpoint
CREATE INDEX `business_owners_business_idx` ON `business_owners` (`business_id`);--> statement-breakpoint
CREATE INDEX `invoices_business_idx` ON `invoices` (`business_id`);--> statement-breakpoint
CREATE INDEX `invoices_customer_email_idx` ON `invoices` (`customer_email`);--> statement-breakpoint
CREATE INDEX `services_business_idx` ON `services` (`business_id`);--> statement-breakpoint
CREATE INDEX `slot_locks_expires_idx` ON `slot_locks` (`expires_at`);--> statement-breakpoint
CREATE INDEX `staff_business_idx` ON `staff` (`business_id`);--> statement-breakpoint
CREATE INDEX `time_blocks_staff_start_idx` ON `time_blocks` (`staff_id`,`start_at`);