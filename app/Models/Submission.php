<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Submission extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'assignment_id',
        'portal_user_id',
        'file_name',
        'file_path',
        'file_mime',
        'file_size',
        'file_version',
        'comment',
        'score',
        'feedback',
        'status',
    ];

    public function assignment()
    {
        return $this->belongsTo(Assignment::class);
    }
}
