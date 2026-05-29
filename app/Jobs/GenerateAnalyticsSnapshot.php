<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Pre-computes analytics from the SQL views and caches them.
 * Scheduled to run every 15 minutes.
 */
class GenerateAnalyticsSnapshot implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // Assignment analytics from view
        $assignmentAnalytics = DB::table('vw_assignment_analytics')
            ->orderByDesc('total_submissions')
            ->get();

        Cache::put('taskflow:analytics:assignments', $assignmentAnalytics, now()->addMinutes(20));

        // Submission trend (last 30 days)
        $trend = DB::select('CALL sp_submission_trend(?)', [30]);
        Cache::put('taskflow:analytics:trend', $trend, now()->addMinutes(20));

        // Overdue report
        $overdue = DB::select('CALL sp_overdue_report()');
        Cache::put('taskflow:analytics:overdue', $overdue, now()->addMinutes(20));

        // Student productivity
        $productivity = DB::table('vw_student_productivity')
            ->orderByDesc('total_submissions')
            ->get();
        Cache::put('taskflow:analytics:productivity', $productivity, now()->addMinutes(20));

        ActivityLog::record('Analytics snapshot refreshed.', 'purple');
    }
}
