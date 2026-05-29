<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use App\Models\Assignment;
use App\Services\EventPublisher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Scans for assignments due within 24 hours and publishes deadline reminder events.
 * Scheduled to run hourly via the Laravel scheduler.
 */
class SendDeadlineReminders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(EventPublisher $publisher): void
    {
        $soon = Assignment::where('status', 'published')
            ->whereBetween('due_date', [now(), now()->addHours(24)])
            ->get();

        foreach ($soon as $assignment) {
            $publisher->publish('DeadlineApproaching', [
                'assignment_id' => $assignment->id,
                'title'         => $assignment->title,
                'subject'       => $assignment->subject,
                'due_date'      => $assignment->due_date->toDateString(),
                'hours_left'    => now()->diffInHours($assignment->due_date->endOfDay()),
            ]);

            ActivityLog::record(
                "Deadline reminder sent for: {$assignment->title} (due {$assignment->due_date->toDateString()})",
                'amber'
            );
        }
    }
}
