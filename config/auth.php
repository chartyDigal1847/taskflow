<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    |
    | TaskFlow does not store users locally. Identity comes from the DEORIS
    | Portal via SSO session keys (sso_id, sso_role, sso_email, sso_name).
    | Auth::user() is not used — controllers read session directly.
    |
    */

    'defaults' => [
        'guard' => 'web',
    ],

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\Assignment::class,
        ],
    ],

];
