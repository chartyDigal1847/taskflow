<?php

use App\Jobs\GenerateAnalyticsSnapshot;
use App\Jobs\SendDeadlineReminders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ── Scheduled jobs ────────────────────────────────────────────────────────
Schedule::job(new SendDeadlineReminders, 'notifications')->hourly();
Schedule::job(new GenerateAnalyticsSnapshot, 'events')->everyFifteenMinutes();
