<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'message',
        'type',
        'at',
    ];

    protected $casts = [
        'at' => 'datetime',
    ];

    /**
     * Log a new activity entry and keep only the latest 50.
     */
    public static function record(string $message, string $type = 'gray'): void
    {
        static::create(['message' => $message, 'type' => $type, 'at' => now()]);

        // Prune to 50 most recent
        $oldest = static::orderByDesc('at')->skip(50)->first();
        if ($oldest) {
            static::where('at', '<=', $oldest->at)->delete();
        }
    }
}
