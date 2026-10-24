CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`mood` text NOT NULL,
	`note` text NOT NULL,
	`time` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
