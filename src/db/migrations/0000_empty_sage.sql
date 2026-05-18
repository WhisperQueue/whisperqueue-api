CREATE TABLE `transcriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_hash` text NOT NULL,
	`file_url` text NOT NULL,
	`text` text NOT NULL,
	`segments` text NOT NULL,
	`language` text NOT NULL,
	`duration` real NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcriptions_file_hash_unique` ON `transcriptions` (`file_hash`);