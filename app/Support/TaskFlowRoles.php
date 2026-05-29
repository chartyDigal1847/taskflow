<?php

namespace App\Support;

class TaskFlowRoles
{
    public const INSTRUCTOR = 'instructor';

    public const STUDENT = 'student';

    public static function normalize(?string $role): string
    {
        return match ($role) {
            'instructor', 'teacher', 'admin' => self::INSTRUCTOR,
            default => self::STUDENT,
        };
    }

    public static function isInstructor(?string $role): bool
    {
        return self::normalize($role) === self::INSTRUCTOR;
    }
}
