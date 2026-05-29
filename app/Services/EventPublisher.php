<?php

namespace App\Services;

use App\Models\EventOutbox;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Publishes events to the DEORIS Event Hub with HMAC-SHA256 signing,
 * nonce generation, and replay-attack prevention via the outbox pattern.
 */
class EventPublisher
{
    private string $secret;
    private string $hubUrl;
    private string $sourceService = 'taskflow';

    public function __construct()
    {
        $this->secret  = (string) config('taskflow.event_secret', '');
        $this->hubUrl  = rtrim((string) config('app.portal_url', 'https://deoris.test'), '/')
                         . '/api/events/ingest';
    }

    /**
     * Queue an event into the outbox (transactional, no HTTP call here).
     */
    public function queue(string $eventName, array $payload, ?string $correlationId = null): EventOutbox
    {
        $eventId       = (string) Str::uuid();
        $nonce         = Str::random(32);
        $correlationId = $correlationId ?? (string) Str::uuid();
        $timestamp     = now()->toIso8601String();

        $body = [
            'event_id'       => $eventId,
            'event_name'     => $eventName,
            'source_service' => $this->sourceService,
            'schema_version' => '1.0',
            'correlation_id' => $correlationId,
            'timestamp'      => $timestamp,
            'nonce'          => $nonce,
            'payload'        => $payload,
        ];

        $signature = $this->sign($body);

        return EventOutbox::create([
            'event_id'       => $eventId,
            'event_name'     => $eventName,
            'source_service' => $this->sourceService,
            'schema_version' => '1.0',
            'correlation_id' => $correlationId,
            'payload'        => $body,
            'hmac_signature' => $signature,
            'nonce'          => $nonce,
            'status'         => 'pending',
        ]);
    }

    /**
     * Dispatch a single outbox entry to the Event Hub immediately.
     */
    public function dispatch(EventOutbox $entry): bool
    {
        $body = $entry->payload;
        $body['hmac_signature'] = $entry->hmac_signature;

        try {
            $response = Http::timeout(5)
                ->withHeaders([
                    'X-Event-Signature' => $entry->hmac_signature,
                    'X-Event-Source'    => $this->sourceService,
                    'Accept'            => 'application/json',
                ])
                ->post($this->hubUrl, $body);

            if ($response->successful()) {
                $entry->update([
                    'status'  => 'sent',
                    'sent_at' => now(),
                ]);
                return true;
            }

            $entry->increment('attempts');
            $entry->update([
                'status'     => 'failed',
                'last_error' => $response->status() . ': ' . $response->body(),
            ]);
            return false;

        } catch (\Throwable $e) {
            $entry->increment('attempts');
            $entry->update([
                'status'     => 'failed',
                'last_error' => $e->getMessage(),
            ]);
            Log::warning('[TaskFlow EventPublisher] dispatch failed', [
                'event_id' => $entry->event_id,
                'error'    => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Queue and immediately attempt dispatch (fire-and-forget on failure).
     */
    public function publish(string $eventName, array $payload, ?string $correlationId = null): EventOutbox
    {
        $entry = $this->queue($eventName, $payload, $correlationId);
        $this->dispatch($entry);
        return $entry;
    }

    private function sign(array $body): string
    {
        $canonical = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return hash_hmac('sha256', $canonical, $this->secret);
    }
}
