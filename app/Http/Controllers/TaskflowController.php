<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateAnalyticsSnapshot;
use App\Jobs\ProcessSubmissionFile;
use App\Jobs\PublishEventJob;
use App\Models\ActivityLog;
use App\Models\Assignment;
use App\Models\EventOutbox;
use App\Models\Submission;
use App\Services\EventPublisher;
use App\Support\TaskFlowRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TaskflowController extends Controller
{
    public function __construct(private readonly EventPublisher $publisher) {}

    // ── Helpers ──────────────────────────────────────────────────────────

    private function portalId(Request $request): ?string
    {
        $id = $request->session()->get('sso_id');
        return $id !== null && $id !== '' ? (string) $id : null;
    }

    private function role(Request $request): string
    {
        return TaskFlowRoles::normalize($request->session()->get('sso_role'));
    }

    private function denyUnlessInstructor(Request $request): ?JsonResponse
    {
        if (! TaskFlowRoles::isInstructor($this->role($request))) {
            return response()->json(['success' => false, 'message' => 'Only instructors can perform this action.'], 403);
        }
        return null;
    }

    private function throttle(Request $request, string $key, int $maxAttempts = 60): ?JsonResponse
    {
        $limiterKey = $key . ':' . ($this->portalId($request) ?? $request->ip());
        if (RateLimiter::tooManyAttempts($limiterKey, $maxAttempts)) {
            return response()->json(['success' => false, 'message' => 'Too many requests.'], 429);
        }
        RateLimiter::hit($limiterKey, 60);
        return null;
    }

    // ── Pages ─────────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        if (! $request->session()->has('sso_id')) {
            $request->session()->forget(['sso_role', 'sso_name', 'sso_email', 'sso_id', 'user']);
        }
        return view('taskflow');
    }

    // ── SSO ───────────────────────────────────────────────────────────────

    public function ssoExchange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'    => 'required|string|max:500',
            'embedded' => 'sometimes|boolean',
        ]);

        $tokenString = $validated['token'];
        $embedded    = (bool) ($validated['embedded'] ?? $request->boolean('embedded'));

        $portalUrl = rtrim((string) config('app.portal_url', 'https://deoris.test'), '/');

        $response = Http::withHeaders([
            'Accept'        => 'application/json',
            'Authorization' => 'Bearer ' . $tokenString,
        ])->post($portalUrl . '/api/v1/sso/exchange', [
            'token' => $tokenString,
        ]);

        if (! $response->ok()) {
            Log::warning('[TaskFlow SSO] Token exchange failed', ['status' => $response->status()]);
            return response()->json(['success' => false, 'message' => 'Invalid SSO token'], 401);
        }

        $data = $response->json();
        $user = $data['user'] ?? $data['data']['user'] ?? null;

        if (!is_array($user) || empty($user['id'])) {
            return response()->json(['success' => false, 'message' => 'Invalid SSO response'], 401);
        }

        $role  = TaskFlowRoles::normalize($user['role'] ?? 'student');
        $id    = (string) $user['id'];
        $name  = (string) ($user['name'] ?? '');
        $email = strtolower((string) ($user['email'] ?? ''));

        $request->session()->flush();
        $request->session()->put([
            'sso_id'               => $id,
            'sso_role'             => $role,
            'sso_name'             => $name,
            'sso_email'            => $email,
            'sso_embedded'         => $embedded,
            'sso_authenticated_at' => now()->timestamp,
            'user'                 => compact('id', 'role', 'name', 'email'),
        ]);

        Log::info('[TaskFlow SSO] Session established (exchange)', ['sso_id' => $id, 'role' => $role]);
        ActivityLog::record("Session validated for {$name} ({$role})", 'blue');

        return response()->json([
            'success'  => true,
            'user'     => compact('id', 'name', 'email', 'role'),
            'embedded' => $embedded,
        ]);
    }

    public function ssoRedirect(Request $request): JsonResponse|Response
    {
        $role     = TaskFlowRoles::normalize($request->input('role', 'student'));
        $id       = (string) $request->input('id', '');
        $name     = (string) $request->input('name', '');
        $email    = strtolower((string) $request->input('email', ''));
        $embedded = $request->input('embedded') === '1';

        if ($id === '' || $email === '') {
            return response()->json(['success' => false, 'message' => 'Portal identity is required.'], 422);
        }

        $request->session()->put([
            'sso_id'                 => $id,
            'sso_role'               => $role,
            'sso_name'               => $name,
            'sso_email'              => $email,
            'sso_embedded'           => $embedded,
            'sso_authenticated_at'   => now()->timestamp,
            'user'                   => compact('id', 'role', 'name', 'email'),
        ]);

        Log::info('[TaskFlow SSO] Session established', ['sso_id' => $id, 'role' => $role]);
        ActivityLog::record("Session validated for {$name} ({$role})", 'blue');

        if ($request->wantsJson() || str_contains($request->header('accept', ''), 'application/json')) {
            return response()->json(['success' => true, 'user' => compact('id', 'name', 'email', 'role'), 'embedded' => $embedded]);
        }
        return redirect('/');
    }

    public function logout(Request $request): JsonResponse
    {
        $embedded = (bool) $request->session()->get('sso_embedded', false);
        $request->session()->flush();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json([
            'success'  => true,
            'redirect' => config('taskflow.trusted_portal_url', config('app.portal_url')),
            'embedded' => $embedded,
        ]);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────

    public function bootstrap(Request $request): JsonResponse
    {
        $role     = $this->role($request);
        $portalId = $this->portalId($request);

        $assignmentsQuery = Assignment::orderByDesc('created_at');
        $submissionsQuery = Submission::orderByDesc('created_at');

        if ($role === TaskFlowRoles::STUDENT && $portalId) {
            $submissionsQuery->where('portal_user_id', $portalId);
        }

        $assignments = $assignmentsQuery->get()->map(fn ($a) => $this->assignmentPayload($a));
        $submissions = $submissionsQuery->get()->map(fn ($s) => $this->submissionPayload($s));
        $activityLog = ActivityLog::orderByDesc('at')->limit(25)->get()->map(fn ($l) => [
            'message' => $l->message,
            'type'    => $l->type,
            'at'      => $l->at?->toIso8601String(),
        ]);

        return response()->json([
            'success'     => true,
            'role'        => $role,
            'user'        => [
                'id'    => $portalId,
                'name'  => $request->session()->get('sso_name'),
                'email' => $request->session()->get('sso_email'),
                'role'  => $role,
            ],
            'assignments' => $assignments,
            'submissions' => $submissions,
            'activityLog' => $activityLog,
        ]);
    }

    // ── Assignments ───────────────────────────────────────────────────────

    public function indexAssignments(Request $request): JsonResponse
    {
        if ($throttle = $this->throttle($request, 'assignments:index')) return $throttle;

        $query = Assignment::query()->orderByDesc('created_at');

        if ($request->filled('status'))  $query->where('status', $request->status);
        if ($request->filled('subject')) $query->where('subject', 'like', '%' . $request->subject . '%');
        if ($request->filled('grade'))   $query->where('grade', $request->grade);
        if ($request->filled('quarter')) $query->where('quarter', $request->quarter);
        if ($request->filled('search'))  {
            $q = $request->search;
            $query->where(fn ($w) => $w->where('title', 'like', "%{$q}%")->orWhere('subject', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%"));
        }

        $paginated = $query->paginate((int) $request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $paginated->getCollection()->map(fn ($a) => $this->assignmentPayload($a)),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    public function showAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = Assignment::with('submissions')->findOrFail($id);
        return response()->json(['success' => true, 'data' => $this->assignmentPayload($assignment)]);
    }

    public function storeAssignment(Request $request): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;
        if ($throttle = $this->throttle($request, 'assignments:store', 30)) return $throttle;

        $data = $request->validate([
            'title'       => 'required|string|max:255',
            'subject'     => 'required|string|max:255',
            'grade'       => 'required|string|max:100',
            'type'        => 'required|string|in:written,performance,quiz,project,exam',
            'priority'    => 'required|string|in:low,medium,high',
            'quarter'     => 'required|string|in:Q1,Q2,Q3,Q4',
            'dueDate'     => 'required|date|after_or_equal:today',
            'points'      => 'required|integer|min:1|max:1000',
            'description' => 'nullable|string|max:5000',
        ]);

        $assignment = Assignment::create([
            'title'               => $data['title'],
            'subject'             => $data['subject'],
            'grade'               => $data['grade'],
            'type'                => $data['type'],
            'priority'            => $data['priority'],
            'quarter'             => $data['quarter'],
            'due_date'            => $data['dueDate'],
            'points'              => $data['points'],
            'description'         => $data['description'] ?? null,
            'status'              => 'published',
            'created_by_portal_id' => $this->portalId($request),
        ]);

        ActivityLog::record("New assignment posted: {$assignment->title} ({$assignment->subject})", 'blue');

        $entry = $this->publisher->queue('AssignmentCreated', [
            'assignment_id' => $assignment->id,
            'title'         => $assignment->title,
            'subject'       => $assignment->subject,
            'grade'         => $assignment->grade,
            'due_date'      => $assignment->due_date->toDateString(),
            'points'        => $assignment->points,
            'created_by'    => $this->portalId($request),
        ]);
        PublishEventJob::dispatch($entry->id)->onQueue('events');

        return response()->json(['success' => true, 'data' => $this->assignmentPayload($assignment)], 201);
    }

    public function updateAssignment(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;

        $assignment = Assignment::findOrFail($id);
        $data = $request->validate([
            'title'       => 'sometimes|required|string|max:255',
            'subject'     => 'sometimes|required|string|max:255',
            'grade'       => 'sometimes|required|string|max:100',
            'type'        => 'sometimes|required|string|in:written,performance,quiz,project,exam',
            'priority'    => 'sometimes|required|string|in:low,medium,high',
            'quarter'     => 'sometimes|required|string|in:Q1,Q2,Q3,Q4',
            'dueDate'     => 'sometimes|required|date',
            'points'      => 'sometimes|required|integer|min:1|max:1000',
            'description' => 'sometimes|nullable|string|max:5000',
        ]);

        $oldDueDate = $assignment->due_date?->toDateString();

        $assignment->update([
            'title'       => $data['title']       ?? $assignment->title,
            'subject'     => $data['subject']     ?? $assignment->subject,
            'grade'       => $data['grade']        ?? $assignment->grade,
            'type'        => $data['type']         ?? $assignment->type,
            'priority'    => $data['priority']     ?? $assignment->priority,
            'quarter'     => $data['quarter']      ?? $assignment->quarter,
            'due_date'    => $data['dueDate']      ?? $assignment->due_date,
            'points'      => $data['points']       ?? $assignment->points,
            'description' => $data['description']  ?? $assignment->description,
        ]);

        ActivityLog::record("Assignment updated: {$assignment->title}", 'amber');

        // Publish DeadlineExtended if due date changed
        if (isset($data['dueDate']) && $data['dueDate'] !== $oldDueDate) {
            $entry = $this->publisher->queue('DeadlineExtended', [
                'assignment_id' => $assignment->id,
                'title'         => $assignment->title,
                'old_due_date'  => $oldDueDate,
                'new_due_date'  => $assignment->due_date->toDateString(),
            ]);
            PublishEventJob::dispatch($entry->id)->onQueue('events');
        }

        return response()->json(['success' => true, 'data' => $this->assignmentPayload($assignment)]);
    }

    public function updateAssignmentStatus(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;

        $assignment = Assignment::findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:draft,published,submitted,late_submission,under_review,graded,feedback_released,closed',
        ]);
        $assignment->update(['status' => $data['status']]);
        ActivityLog::record("Assignment \"{$assignment->title}\" marked as {$data['status']}", 'amber');

        return response()->json(['success' => true, 'status' => $assignment->status]);
    }

    public function destroyAssignment(Request $request, int $id): Response
    {
        if ($denied = $this->denyUnlessInstructor($request)) {
            return response('Unauthorized', 403);
        }
        $assignment = Assignment::findOrFail($id);
        $title = $assignment->title;
        $assignment->delete(); // soft delete
        ActivityLog::record("Assignment deleted: {$title}", 'red');
        return response()->noContent();
    }

    // ── Submissions ───────────────────────────────────────────────────────

    public function indexSubmissions(Request $request): JsonResponse
    {
        if ($throttle = $this->throttle($request, 'submissions:index')) return $throttle;

        $role     = $this->role($request);
        $portalId = $this->portalId($request);

        $query = Submission::with('assignment')->orderByDesc('created_at');

        if ($role === TaskFlowRoles::STUDENT && $portalId) {
            $query->where('portal_user_id', $portalId);
        }

        if ($request->filled('status'))        $query->where('status', $request->status);
        if ($request->filled('assignment_id')) $query->where('assignment_id', $request->assignment_id);

        $paginated = $query->paginate((int) $request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $paginated->getCollection()->map(fn ($s) => $this->submissionPayload($s)),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    public function storeSubmission(Request $request): JsonResponse
    {
        if ($this->role($request) !== TaskFlowRoles::STUDENT) {
            return response()->json(['success' => false, 'message' => 'Only students can submit assignments.'], 403);
        }
        if ($throttle = $this->throttle($request, 'submissions:store', 20)) return $throttle;

        $portalId = $this->portalId($request);
        if (! $portalId) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'assignmentId' => 'required|integer|exists:assignments,id',
            'comment'      => 'nullable|string|max:2000',
            'file'         => 'nullable|file|max:20480|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,jpg,jpeg,png',
        ]);

        $assignment = Assignment::findOrFail($data['assignmentId']);

        // Prevent duplicate submission
        $existing = Submission::where('assignment_id', $assignment->id)
            ->where('portal_user_id', $portalId)
            ->whereNotIn('status', ['graded', 'feedback_released'])
            ->first();
        if ($existing) {
            return response()->json(['success' => false, 'message' => 'You already have an active submission for this assignment.'], 409);
        }

        $status   = ($assignment->due_date && $assignment->due_date->isPast()) ? 'late_submission' : 'submitted';
        $fileName = null;
        $filePath = null;
        $fileMime = null;
        $fileSize = null;

        if ($request->hasFile('file')) {
            $file     = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $fileMime = $file->getMimeType();
            $fileSize = $file->getSize();
            $filePath = $file->store(
                'submissions/' . date('Y/m'),
                'submissions'
            );
        }

        $submission = Submission::create([
            'assignment_id'  => $assignment->id,
            'portal_user_id' => $portalId,
            'file_name'      => $fileName,
            'file_path'      => $filePath,
            'file_mime'      => $fileMime,
            'file_size'      => $fileSize,
            'file_version'   => '1',
            'comment'        => $data['comment'] ?? null,
            'status'         => $status,
        ]);

        if ($filePath) {
            ProcessSubmissionFile::dispatch($submission->id)->onQueue('submissions');
        }

        ActivityLog::record("Submission received for: {$assignment->title}", 'green');

        $entry = $this->publisher->queue('SubmissionReceived', [
            'submission_id'  => $submission->id,
            'assignment_id'  => $assignment->id,
            'assignment_title' => $assignment->title,
            'portal_user_id' => $portalId,
            'status'         => $status,
            'has_file'       => (bool) $filePath,
        ]);
        PublishEventJob::dispatch($entry->id)->onQueue('events');

        return response()->json(['success' => true, 'data' => $this->submissionPayload($submission)], 201);
    }

    public function gradeSubmission(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;

        $submission = Submission::findOrFail($id);
        $data = $request->validate([
            'score'    => 'required|integer|min:0|max:1000',
            'feedback' => 'nullable|string|max:5000',
        ]);

        $submission->update([
            'score'    => $data['score'],
            'feedback' => $data['feedback'] ?? null,
            'status'   => 'graded',
        ]);

        $assignment = Assignment::find($submission->assignment_id);
        if ($assignment) {
            ActivityLog::record("Submission graded: {$assignment->title} — Score: {$data['score']}", 'green');
        }

        $entry = $this->publisher->queue('SubmissionReviewed', [
            'submission_id'  => $submission->id,
            'assignment_id'  => $submission->assignment_id,
            'portal_user_id' => $submission->portal_user_id,
            'score'          => $data['score'],
            'graded_by'      => $this->portalId($request),
        ]);
        PublishEventJob::dispatch($entry->id)->onQueue('events');

        return response()->json(['success' => true, 'data' => $this->submissionPayload($submission)]);
    }

    public function releaseFeedback(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;

        $submission = Submission::findOrFail($id);
        if ($submission->status !== 'graded') {
            return response()->json(['success' => false, 'message' => 'Submission must be graded before releasing feedback.'], 422);
        }

        $submission->update(['status' => 'feedback_released']);
        ActivityLog::record("Feedback released for submission #{$submission->id}", 'blue');

        $entry = $this->publisher->queue('FeedbackReleased', [
            'submission_id'  => $submission->id,
            'assignment_id'  => $submission->assignment_id,
            'portal_user_id' => $submission->portal_user_id,
            'score'          => $submission->score,
        ]);
        PublishEventJob::dispatch($entry->id)->onQueue('events');

        return response()->json(['success' => true, 'data' => $this->submissionPayload($submission)]);
    }

    public function destroySubmission(Request $request, int $id): Response
    {
        if ($denied = $this->denyUnlessInstructor($request)) {
            return response('Unauthorized', 403);
        }
        $submission = Submission::findOrFail($id);
        if ($submission->file_path) {
            Storage::disk('submissions')->delete($submission->file_path);
        }
        $submission->delete(); // soft delete
        ActivityLog::record("Submission deleted (ID: {$id})", 'red');
        return response()->noContent();
    }

    public function downloadSubmissionFile(Request $request, int $id): mixed
    {
        $submission = Submission::findOrFail($id);

        // Students can only download their own; instructors can download any
        if ($this->role($request) === TaskFlowRoles::STUDENT
            && (string) $submission->portal_user_id !== (string) $this->portalId($request)) {
            abort(403, 'Access denied.');
        }

        if (! $submission->file_path || ! Storage::disk('submissions')->exists($submission->file_path)) {
            abort(404, 'File not found.');
        }

        ActivityLog::record("File downloaded: {$submission->file_name} (submission #{$id})", 'gray');

        return Storage::disk('submissions')->download($submission->file_path, $submission->file_name);
    }

    // ── Feedback ──────────────────────────────────────────────────────────

    public function indexFeedback(Request $request): JsonResponse
    {
        $portalId = $this->portalId($request);
        $role     = $this->role($request);

        $query = Submission::with('assignment')
            ->whereIn('status', ['graded', 'feedback_released'])
            ->orderByDesc('updated_at');

        if ($role === TaskFlowRoles::STUDENT && $portalId) {
            $query->where('portal_user_id', $portalId);
        }

        $paginated = $query->paginate((int) $request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $paginated->getCollection()->map(fn ($s) => [
                'submission_id'    => $s->id,
                'assignment_id'    => $s->assignment_id,
                'assignment_title' => $s->assignment?->title,
                'score'            => $s->score,
                'feedback'         => $s->feedback,
                'status'           => $s->status,
                'graded_at'        => $s->updated_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    // ── Deadlines ─────────────────────────────────────────────────────────

    public function indexDeadlines(Request $request): JsonResponse
    {
        $query = Assignment::select('id', 'title', 'subject', 'grade', 'quarter', 'due_date', 'status', 'points')
            ->whereNotIn('status', ['closed', 'graded'])
            ->orderBy('due_date');

        if ($request->filled('from')) $query->where('due_date', '>=', $request->from);
        if ($request->filled('to'))   $query->where('due_date', '<=', $request->to);

        $deadlines = $query->get()->map(fn ($a) => [
            'id'       => $a->id,
            'title'    => $a->title,
            'subject'  => $a->subject,
            'grade'    => $a->grade,
            'quarter'  => $a->quarter,
            'due_date' => $a->due_date?->toDateString(),
            'status'   => $a->status,
            'points'   => $a->points,
            'is_overdue' => $a->due_date && $a->due_date->isPast(),
            'days_until' => $a->due_date ? (int) now()->startOfDay()->diffInDays($a->due_date->startOfDay(), false) : null,
        ]);

        return response()->json(['success' => true, 'data' => $deadlines]);
    }

    // ── Calendar ──────────────────────────────────────────────────────────

    public function calendar(Request $request): JsonResponse
    {
        $month = $request->get('month', now()->month);
        $year  = $request->get('year', now()->year);

        $assignments = Assignment::whereMonth('due_date', $month)
            ->whereYear('due_date', $year)
            ->get()
            ->map(fn ($a) => [
                'id'      => $a->id,
                'title'   => $a->title,
                'subject' => $a->subject,
                'date'    => $a->due_date?->toDateString(),
                'status'  => $a->status,
                'points'  => $a->points,
                'type'    => 'assignment',
            ]);

        return response()->json(['success' => true, 'data' => $assignments, 'month' => $month, 'year' => $year]);
    }

    // ── Search (federated) ────────────────────────────────────────────────

    public function search(Request $request): JsonResponse
    {
        if ($throttle = $this->throttle($request, 'search', 30)) return $throttle;

        $q = trim((string) $request->get('q', ''));
        if (strlen($q) < 2) {
            return response()->json(['success' => true, 'results' => []]);
        }

        $cacheKey = 'taskflow:search:' . md5($q . $this->role($request));
        $results  = Cache::remember($cacheKey, 30, function () use ($q) {
            $assignments = Assignment::where('title', 'like', "%{$q}%")
                ->orWhere('subject', 'like', "%{$q}%")
                ->orWhere('description', 'like', "%{$q}%")
                ->limit(10)
                ->get()
                ->map(fn ($a) => [
                    'type'    => 'assignment',
                    'id'      => $a->id,
                    'title'   => $a->title,
                    'excerpt' => $a->subject . ' · ' . $a->grade,
                    'url'     => null,
                ]);

            $submissions = Submission::where('comment', 'like', "%{$q}%")
                ->orWhere('file_name', 'like', "%{$q}%")
                ->limit(5)
                ->get()
                ->map(fn ($s) => [
                    'type'    => 'submission',
                    'id'      => $s->id,
                    'title'   => $s->file_name ?? 'Submission #' . $s->id,
                    'excerpt' => $s->comment ?? '',
                    'url'     => null,
                ]);

            return $assignments->merge($submissions)->values();
        });

        return response()->json(['success' => true, 'results' => $results]);
    }

    // ── Analytics ─────────────────────────────────────────────────────────

    public function analytics(Request $request): JsonResponse
    {
        if ($denied = $this->denyUnlessInstructor($request)) return $denied;

        $assignmentAnalytics = Cache::get('taskflow:analytics:assignments',
            fn () => DB::table('vw_assignment_analytics')->orderByDesc('total_submissions')->get()
        );
        $trend = Cache::get('taskflow:analytics:trend',
            fn () => DB::select('CALL sp_submission_trend(?)', [30])
        );
        $overdue = Cache::get('taskflow:analytics:overdue',
            fn () => DB::select('CALL sp_overdue_report()')
        );
        $productivity = Cache::get('taskflow:analytics:productivity',
            fn () => DB::table('vw_student_productivity')->orderByDesc('total_submissions')->get()
        );

        // Aggregate summary stats
        $totalAssignments  = Assignment::count();
        $totalSubmissions  = Submission::count();
        $gradedSubmissions = Submission::where('status', 'graded')->count();
        $overdueCount      = Assignment::where('due_date', '<', now())
            ->whereNotIn('status', ['graded', 'closed', 'feedback_released'])
            ->count();

        GenerateAnalyticsSnapshot::dispatch()->onQueue('events');

        return response()->json([
            'success' => true,
            'summary' => [
                'total_assignments'   => $totalAssignments,
                'total_submissions'   => $totalSubmissions,
                'graded_submissions'  => $gradedSubmissions,
                'overdue_assignments' => $overdueCount,
            ],
            'assignment_analytics' => $assignmentAnalytics,
            'submission_trend'     => $trend,
            'overdue_report'       => $overdue,
            'student_productivity' => $productivity,
        ]);
    }

    // ── Payload helpers ───────────────────────────────────────────────────

    private function assignmentPayload(Assignment $assignment): array
    {
        return [
            'id'          => $assignment->id,
            'title'       => $assignment->title,
            'subject'     => $assignment->subject,
            'grade'       => $assignment->grade,
            'type'        => $assignment->type,
            'priority'    => $assignment->priority,
            'quarter'     => $assignment->quarter,
            'dueDate'     => $assignment->due_date?->format('Y-m-d'),
            'points'      => $assignment->points,
            'description' => $assignment->description,
            'status'      => $assignment->status,
            'isOverdue'   => $assignment->isOverdue(),
            'createdBy'   => $assignment->created_by_portal_id,
        ];
    }

    private function submissionPayload(Submission $submission): array
    {
        return [
            'id'           => $submission->id,
            'assignmentId' => $submission->assignment_id,
            'portalUserId' => $submission->portal_user_id,
            'fileName'     => $submission->file_name,
            'fileMime'     => $submission->file_mime,
            'fileSize'     => $submission->file_size,
            'fileVersion'  => $submission->file_version,
            'hasFile'      => (bool) $submission->file_path,
            'comment'      => $submission->comment,
            'score'        => $submission->score,
            'feedback'     => $submission->feedback,
            'status'       => $submission->status,
            'createdAt'    => $submission->created_at?->toIso8601String(),
        ];
    }
}
