<?php

namespace App\Jobs;

use App\Models\EventOutbox;
use App\Services\EventPublisher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PublishEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(private readonly int $outboxId) {}

    public function handle(EventPublisher $publisher): void
    {
        $entry = EventOutbox::find($this->outboxId);
        if (! $entry || $entry->status === 'sent') {
            return;
        }
        $publisher->dispatch($entry);
    }
}
