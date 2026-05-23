-- Migration: Unify 4 zone tables into single character table
-- Run against junuyiwo-v2 database

-- 1. Create new tables
CREATE TABLE IF NOT EXISTS `character` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `character` VARCHAR(1) NOT NULL COMMENT '汉字',
    `zone` ENUM('target','scout','ally','lost') NOT NULL DEFAULT 'target',
    `tap_count` INT NOT NULL DEFAULT 0 COMMENT '累计点读次数',
    `appeared_in_articles` INT NOT NULL DEFAULT 0,
    `never_tapped_in_articles` INT NOT NULL DEFAULT 0,
    `first_seen_at` DATE NULL,
    `last_tapped_at` DATETIME NULL,
    `zone_changed_at` DATETIME NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_zone (`student_id`, `zone`),
    INDEX idx_student_char (`student_id`, `character`),
    CONSTRAINT fk_char_student FOREIGN KEY (`student_id`) REFERENCES `student`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `character_interaction` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `character` VARCHAR(1) NOT NULL,
    `article_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_char (`student_id`, `character`),
    INDEX idx_student_created (`student_id`, `created_at`),
    CONSTRAINT fk_ci_student FOREIGN KEY (`student_id`) REFERENCES `student`(`id`),
    CONSTRAINT fk_ci_article FOREIGN KEY (`article_id`) REFERENCES `daily_article`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `character_zone_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `character` VARCHAR(1) NOT NULL,
    `from_zone` VARCHAR(10) NOT NULL,
    `to_zone` VARCHAR(10) NOT NULL,
    `reason` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `article_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_char (`student_id`, `character`),
    CONSTRAINT fk_czl_student FOREIGN KEY (`student_id`) REFERENCES `student`(`id`),
    CONSTRAINT fk_czl_article FOREIGN KEY (`article_id`) REFERENCES `daily_article`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Migrate data from old zone tables to new character table

-- Migrate target_character
INSERT INTO `character` (`student_id`, `character`, `zone`, `tap_count`, `source`, `created_at`)
SELECT `student_id`, `character`, 'target', 0, 'manual', COALESCE(`created_at`, NOW())
FROM `target_character`;

-- Migrate scout_character
INSERT INTO `character` (`student_id`, `character`, `zone`, `tap_count`, `source`, `created_at`)
SELECT `student_id`, `character`, 'scout', 0, 'manual', COALESCE(`created_at`, NOW())
FROM `scout_character`;

-- Migrate ally_character
INSERT INTO `character` (`student_id`, `character`, `zone`, `tap_count`, `source`, `created_at`)
SELECT `student_id`, `character`, 'ally', 0, 'manual', COALESCE(`created_at`, NOW())
FROM `ally_character`;

-- Migrate lost_character
INSERT INTO `character` (`student_id`, `character`, `zone`, `tap_count`, `source`, `created_at`)
SELECT `student_id`, `character`, 'lost', 0, 'manual', COALESCE(`created_at`, NOW())
FROM `lost_character`;

-- 3. Drop old tables (run after verifying migration)
-- DROP TABLE IF EXISTS `target_character`;
-- DROP TABLE IF EXISTS `scout_character`;
-- DROP TABLE IF EXISTS `ally_character`;
-- DROP TABLE IF EXISTS `lost_character`;
