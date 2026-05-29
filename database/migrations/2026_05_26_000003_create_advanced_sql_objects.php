<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── View: assignment completion analytics ─────────────────────────
        DB::statement("
            CREATE OR REPLACE VIEW vw_assignment_analytics AS
            SELECT
                a.id,
                a.title,
                a.subject,
                a.grade,
                a.quarter,
                a.due_date,
                a.points,
                a.status,
                COUNT(s.id)                                          AS total_submissions,
                COUNT(CASE WHEN s.status = 'graded' THEN 1 END)     AS graded_count,
                COUNT(CASE WHEN s.status = 'late_submission' THEN 1 END) AS late_count,
                ROUND(AVG(s.score), 2)                               AS avg_score,
                MAX(s.score)                                         AS max_score,
                MIN(s.score)                                         AS min_score,
                CASE
                    WHEN a.due_date < CURDATE() AND a.status NOT IN ('graded','closed') THEN 1
                    ELSE 0
                END                                                  AS is_overdue
            FROM assignments a
            LEFT JOIN submissions s ON s.assignment_id = a.id AND s.deleted_at IS NULL
            WHERE a.deleted_at IS NULL
            GROUP BY a.id, a.title, a.subject, a.grade, a.quarter,
                     a.due_date, a.points, a.status
        ");

        // ── View: student productivity ────────────────────────────────────
        DB::statement("
            CREATE OR REPLACE VIEW vw_student_productivity AS
            SELECT
                s.portal_user_id,
                COUNT(s.id)                                              AS total_submissions,
                COUNT(CASE WHEN s.status = 'graded' THEN 1 END)         AS graded_submissions,
                COUNT(CASE WHEN s.status = 'late_submission' THEN 1 END) AS late_submissions,
                ROUND(AVG(s.score), 2)                                   AS avg_score,
                MAX(s.score)                                             AS best_score,
                COUNT(DISTINCT s.assignment_id)                          AS assignments_attempted
            FROM submissions s
            WHERE s.deleted_at IS NULL
            GROUP BY s.portal_user_id
        ");

        // ── View: instructor grading summary ──────────────────────────────
        DB::statement("
            CREATE OR REPLACE VIEW vw_instructor_grading_summary AS
            SELECT
                a.created_by_portal_id                                   AS instructor_portal_id,
                COUNT(DISTINCT a.id)                                     AS total_assignments,
                COUNT(s.id)                                              AS total_submissions_received,
                COUNT(CASE WHEN s.status = 'graded' THEN 1 END)         AS total_graded,
                COUNT(CASE WHEN s.status IN ('submitted','late_submission','under_review') THEN 1 END) AS pending_review,
                ROUND(AVG(s.score), 2)                                   AS overall_avg_score
            FROM assignments a
            LEFT JOIN submissions s ON s.assignment_id = a.id AND s.deleted_at IS NULL
            WHERE a.deleted_at IS NULL
            GROUP BY a.created_by_portal_id
        ");

        // ── Trigger: auto-mark overdue assignments ────────────────────────
        DB::statement("DROP TRIGGER IF EXISTS trg_auto_overdue_check");
        DB::statement("
            CREATE TRIGGER trg_auto_overdue_check
            BEFORE UPDATE ON assignments
            FOR EACH ROW
            BEGIN
                IF NEW.due_date < CURDATE()
                   AND NEW.status = 'published'
                   AND OLD.status = 'published' THEN
                    SET NEW.status = 'closed';
                END IF;
            END
        ");

        // ── Trigger: log submission status changes ────────────────────────
        DB::statement("DROP TRIGGER IF EXISTS trg_log_submission_status_change");
        DB::statement("
            CREATE TRIGGER trg_log_submission_status_change
            AFTER UPDATE ON submissions
            FOR EACH ROW
            BEGIN
                IF OLD.status <> NEW.status THEN
                    INSERT INTO activity_logs (message, type, at, created_at, updated_at)
                    VALUES (
                        CONCAT('Submission #', NEW.id, ' status changed: ', OLD.status, ' → ', NEW.status),
                        CASE NEW.status
                            WHEN 'graded'           THEN 'green'
                            WHEN 'feedback_released' THEN 'blue'
                            WHEN 'under_review'     THEN 'amber'
                            ELSE 'gray'
                        END,
                        NOW(), NOW(), NOW()
                    );
                END IF;
            END
        ");

        // ── Stored procedure: overdue report ──────────────────────────────
        DB::statement("DROP PROCEDURE IF EXISTS sp_overdue_report");
        DB::statement("
            CREATE PROCEDURE sp_overdue_report()
            BEGIN
                SELECT
                    a.id,
                    a.title,
                    a.subject,
                    a.grade,
                    a.due_date,
                    DATEDIFF(CURDATE(), a.due_date) AS days_overdue,
                    COUNT(s.id)                     AS submissions_received
                FROM assignments a
                LEFT JOIN submissions s ON s.assignment_id = a.id AND s.deleted_at IS NULL
                WHERE a.deleted_at IS NULL
                  AND a.due_date < CURDATE()
                  AND a.status NOT IN ('graded', 'closed')
                GROUP BY a.id, a.title, a.subject, a.grade, a.due_date
                ORDER BY days_overdue DESC;
            END
        ");

        // ── Stored procedure: submission trend (last N days) ──────────────
        DB::statement("DROP PROCEDURE IF EXISTS sp_submission_trend");
        DB::statement("
            CREATE PROCEDURE sp_submission_trend(IN days_back INT)
            BEGIN
                SELECT
                    DATE(s.created_at)  AS submission_date,
                    COUNT(s.id)         AS total,
                    COUNT(CASE WHEN s.status = 'late_submission' THEN 1 END) AS late_count
                FROM submissions s
                WHERE s.deleted_at IS NULL
                  AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL days_back DAY)
                GROUP BY DATE(s.created_at)
                ORDER BY submission_date ASC;
            END
        ");
    }

    public function down(): void
    {
        DB::statement("DROP TRIGGER IF EXISTS trg_log_submission_status_change");
        DB::statement("DROP TRIGGER IF EXISTS trg_auto_overdue_check");
        DB::statement("DROP PROCEDURE IF EXISTS sp_submission_trend");
        DB::statement("DROP PROCEDURE IF EXISTS sp_overdue_report");
        DB::statement("DROP VIEW IF EXISTS vw_instructor_grading_summary");
        DB::statement("DROP VIEW IF EXISTS vw_student_productivity");
        DB::statement("DROP VIEW IF EXISTS vw_assignment_analytics");
    }
};
