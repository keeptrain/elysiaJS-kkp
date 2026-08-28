CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`userId` text(36) NOT NULL,
	`token` text(64) NOT NULL UNIQUE,
	`expiresAt` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);
