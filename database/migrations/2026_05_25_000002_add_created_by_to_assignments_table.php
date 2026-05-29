<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('assignments')) {
            return;
        }

        if (! Schema::hasColumn('assignments', 'created_by_portal_id')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by_portal_id')->nullable()->after('status');
                $table->index('created_by_portal_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('assignments', 'created_by_portal_id')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->dropIndex(['created_by_portal_id']);
                $table->dropColumn('created_by_portal_id');
            });
        }
    }
};
