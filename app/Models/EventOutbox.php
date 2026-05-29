<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EventOutbox extends Model
{
    protected $table = 'event_outbox';

    protected $fillable = [
        'event_id',
        'event_name',
        'source_service',
        'schema_version',
        'correlation_id',
        'payload',
        'hmac_signature',
        'nonce',
        'status',
        'attempts',
        'sent_at',
        'last_error',
    ];

    protected $casts = [
        'payload'  => 'array',
        'sent_at'  => 'datetime',
    ];
}
