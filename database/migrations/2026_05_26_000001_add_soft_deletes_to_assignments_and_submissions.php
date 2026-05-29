<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->softDeletes()->after('updated_at');
        });

        Schema::table('submissions', function (Blueprint $table) {
            $table->softDeletes()->after('updated_at');
            $table->string('file_path')->nullable()->after('file_name');
            $table->string('file_mime')->nullable()->after('file_path');
            $table->unsignedBigInteger('file_size')->nullable()->after('file_mime');
            $table->string('file_version')->default('1')->after('file_size');
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('submissions', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['file_path', 'file_mime', 'file_size', 'file_version']);
        });
    }
};
