<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractor_details', function (Blueprint $table): void {
            $table->string('profile_image_path')->nullable()->after('business_hours');
        });

        DB::table('contractor_details')
            ->join('listings', 'listings.id', '=', 'contractor_details.listing_id')
            ->whereNull('contractor_details.profile_image_path')
            ->whereNotNull('listings.image')
            ->update([
                'contractor_details.profile_image_path' => DB::raw('listings.image'),
            ]);
    }

    public function down(): void
    {
        Schema::table('contractor_details', function (Blueprint $table): void {
            $table->dropColumn('profile_image_path');
        });
    }
};
