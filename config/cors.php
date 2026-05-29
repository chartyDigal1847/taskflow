<?php

return [

    'paths' => ['taskflow/api/*', 'sso/redirect', 'logout'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('APP_PORTAL_URL', 'https://deoris.test'),
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => true,

];