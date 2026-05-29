<?php

return [

    'service_name' => env('TASKFLOW_SERVICE_NAME', 'TaskFlow'),
    'service_key' => env('TASKFLOW_SERVICE_KEY', 'taskflow-service'),
    'service_url' => env('TASKFLOW_SERVICE_URL', env('APP_URL', 'https://taskflow.deoris.test')),
    'api_version' => env('TASKFLOW_API_VERSION', 'v1'),
    'trusted_portal_url' => env('APP_PORTAL_URL', 'https://deoris.test'),

    'event_secret' => env('TASKFLOW_EVENT_SECRET'),
    'redis_channels' => [
        'assignments' => env('TASKFLOW_REDIS_CHANNEL_ASSIGNMENTS', 'assignments.events'),
        'notifications' => env('TASKFLOW_REDIS_CHANNEL_NOTIFICATIONS', 'tasks.notifications'),
    ],
    'queue_names' => [
        'assignments' => env('TASKFLOW_QUEUE_ASSIGNMENTS', 'assignments'),
        'submissions' => env('TASKFLOW_QUEUE_SUBMISSIONS', 'submissions'),
        'notifications' => env('TASKFLOW_QUEUE_NOTIFICATIONS', 'notifications'),
        'events' => env('TASKFLOW_QUEUE_EVENTS', 'events'),
    ],

];
