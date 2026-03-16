<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarMake;
use App\Models\CarModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CarCatalogController extends Controller
{
    public function driveTypes(): JsonResponse
    {
        $driveTypes = [
            'Front-Wheel Drive',
            'Rear-Wheel Drive',
            'All-Wheel Drive',
            'Four-Wheel Drive',
        ];

        return response()->json([
            'data' => collect($driveTypes)->map(fn (string $name) => [
                'name' => $name,
                'slug' => Str::slug($name) ?: $name,
            ])->values(),
        ]);
    }

    public function engines(Request $request): JsonResponse
    {
        $driveSlug = Str::slug(trim($request->string('drive')->toString()));
        abort_unless($driveSlug !== '', 400);

        $map = [
            'front-wheel-drive' => [
                'Inline-3',
                'Inline-4',
                'Inline-4 Turbo',
                'Hybrid',
                'Electric',
            ],
            'rear-wheel-drive' => [
                'Inline-4',
                'Inline-6',
                'V6',
                'V8',
                'V10',
                'V12',
                'Electric',
            ],
            'all-wheel-drive' => [
                'Inline-4',
                'Inline-4 Turbo',
                'Inline-6',
                'V6',
                '6-Cylinder Turbo',
                'V8',
                'Hybrid',
                'Electric',
            ],
            'four-wheel-drive' => [
                'V6',
                '6-Cylinder Turbo',
                'V8',
                'Diesel',
                'Hybrid',
            ],
        ];

        $engines = $map[$driveSlug] ?? [];

        return response()->json([
            'data' => collect($engines)->map(fn (string $name) => [
                'name' => $name,
                'slug' => Str::slug($name) ?: $name,
            ])->values(),
        ]);
    }

    public function makes(): JsonResponse
    {
        if (!Schema::hasTable('car_makes')) {
            return response()->json(['data' => []]);
        }

        $makes = CarMake::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['name', 'slug'])
            ->map(fn (CarMake $make) => [
                'name' => $make->name,
                'slug' => $make->slug,
            ])
            ->values();

        return response()->json(['data' => $makes]);
    }

    public function models(Request $request): JsonResponse
    {
        $makeSlug = trim($request->string('make')->toString());
        abort_unless($makeSlug !== '', 400);

        if (!Schema::hasTable('car_makes') || !Schema::hasTable('car_models')) {
            return response()->json(['data' => []]);
        }

        $make = CarMake::query()
            ->where('slug', $makeSlug)
            ->where('is_active', true)
            ->first();
        abort_unless($make, 404);

        $models = CarModel::query()
            ->where('make_id', $make->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['name', 'slug'])
            ->map(fn (CarModel $model) => [
                'name' => $model->name,
                'slug' => $model->slug,
            ])
            ->values();

        return response()->json(['data' => $models]);
    }
}
