<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Assignment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'created_by_portal_id',
        'title', 'subject', 'grade', 'type', 'priority',
        'quarter', 'due_date', 'points', 'description',
        'status',
    ];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function submissions()
    {
        return $this->hasMany(Submission::class);
    }

    public function isOverdue(): bool
    {
        return $this->due_date && $this->due_date->isPast()
            && ! in_array($this->status, ['graded', 'closed', 'feedback_released']);
    }
}