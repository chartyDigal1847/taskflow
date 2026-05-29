<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use App\Models\Submission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Processes an uploaded submission file:
 * - Validates the stored file still exists
 * - Hooks for virus/malware scanning (stub — integrate ClamAV or similar)
 * - Updates submission status to 'submitted' after processing
 */
class ProcessSubmissionFile implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 15;

    public function __construct(private readonly int $submissionId) {}

    public function handle(): void
    {
        $submission = Submission::find($this->submissionId);
        if (! $submission || ! $submission->file_path) {
            return;
        }

        // Verify file exists in storage
        if (! Storage::disk('submissions')->exists($submission->file_path)) {
            Log::warning('[TaskFlow] Submission file missing', [
                'submission_id' => $submission->id,
                'file_path'     => $submission->file_path,
            ]);
            $submission->update(['status' => 'submitted']); // still allow, file may be optional
            return;
        }

        // ── Virus scan hook ───────────────────────────────────────────────
        // Integrate ClamAV or cloud AV here. For now we log and pass.
        Log::info('[TaskFlow] File scan hook — integrate AV scanner here', [
            'submission_id' => $submission->id,
            'file'          => $submission->file_name,
            'size'          => $submission->file_size,
        ]);

        ActivityLog::record(
            "File processed for submission #{$submission->id}: {$submission->file_name}",
            'blue'
        );
    }
}
