CREATE TABLE `otps` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text(254) NOT NULL,
	`code` text(6) NOT NULL,
	`isUsed` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
