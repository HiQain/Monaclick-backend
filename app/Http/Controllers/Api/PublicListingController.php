<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\City;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicListingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $module = $request->string('module')->toString();
        $perPage = min(max((int) $request->integer('per_page', 8), 1), 24);

        $query = Listing::query()
            ->with([
                'category:id,name,slug',
                'city:id,name,slug',
                'eventDetail:listing_id,starts_at,ends_at,venue,capacity',
            ])
            ->where('status', 'published');

        if ($module !== '') {
            $query->where('module', $module);
        }

        if ($request->filled('category')) {
            $category = $request->string('category')->toString();
            $query->whereHas('category', fn ($builder) => $builder->where('slug', $category));
        }

        if ($request->filled('city')) {
            $city = $request->string('city')->toString();
            $query->whereHas('city', fn ($builder) => $builder->where('slug', $city));
        }

        if ($request->filled('q')) {
            $term = $request->string('q')->toString();
            $query->where(function ($builder) use ($term): void {
                $builder->where('title', 'like', "%{$term}%")
                    ->orWhere('excerpt', 'like', "%{$term}%");
            });
        }

        $ratingValues = collect(explode(',', $request->string('ratings')->toString()))
            ->map(fn (string $value) => (int) trim($value))
            ->filter(fn (int $value) => $value >= 1 && $value <= 5)
            ->values();

        if ($ratingValues->isNotEmpty()) {
            $query->where(function ($builder) use ($ratingValues): void {
                foreach ($ratingValues as $ratingValue) {
                    if ($ratingValue === 5) {
                        $builder->orWhere('rating', '>=', 4.5);
                        continue;
                    }

                    $min = max(0, $ratingValue - 0.5);
                    $max = $ratingValue + 0.5;
                    $builder->orWhereBetween('rating', [$min, $max]);
                }
            });
        }

        if ($request->boolean('availability')) {
            $query->where('availability_now', true);
        }

        $budgetValues = collect(explode(',', $request->string('budgets')->toString()))
            ->map(fn (string $value) => (int) trim($value))
            ->filter(fn (int $value) => $value >= 1 && $value <= 4)
            ->values();

        if ($budgetValues->isNotEmpty()) {
            $query->whereIn('budget_tier', $budgetValues->all());
        }

        $featureValues = collect(explode(',', $request->string('features')->toString()))
            ->map(fn (string $value) => trim($value))
            ->filter(fn (string $value) => $value !== '')
            ->values();

        foreach ($featureValues as $featureValue) {
            $query->whereJsonContains('features', $featureValue);
        }

        $sort = $request->string('sort')->toString();

        if ($sort === 'rating') {
            $query->orderByDesc('rating')->orderByDesc('reviews_count')->latest('id');
        } else {
            $query->latest('published_at')->latest('id');
        }

        $paginated = $query->paginate($perPage)->withQueryString();

        $categories = Category::query()
            ->when($module !== '', fn ($builder) => $builder->where('module', $module))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['name', 'slug'])
            ->map(fn (Category $category) => [
                'name' => $category->name,
                'slug' => $category->slug,
            ])
            ->values();

        $cities = City::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['name', 'slug'])
            ->map(fn (City $city) => [
                'name' => $city->name,
                'slug' => $city->slug,
            ])
            ->values();

        return response()->json([
            'data' => $paginated->getCollection()->map(fn (Listing $listing) => [
                'id' => $listing->id,
                'title' => $listing->title,
                'slug' => $listing->slug,
                'module' => $listing->module,
                'excerpt' => $listing->excerpt,
                'price' => $listing->display_price,
                'budget_tier' => (int) $listing->budget_tier,
                'availability_now' => (bool) $listing->availability_now,
                'features' => array_values($listing->features ?? []),
                'rating' => (float) $listing->rating,
                'reviews_count' => (int) $listing->reviews_count,
                'image_url' => $listing->image_url,
                'category' => [
                    'name' => $listing->category?->name,
                    'slug' => $listing->category?->slug,
                ],
                'city' => [
                    'name' => $listing->city?->name,
                    'slug' => $listing->city?->slug,
                ],
                'details' => [
                    'event' => $listing->eventDetail ? [
                        'starts_at' => optional($listing->eventDetail->starts_at)->toIso8601String(),
                        'ends_at' => optional($listing->eventDetail->ends_at)->toIso8601String(),
                        'venue' => $listing->eventDetail->venue,
                        'capacity' => $listing->eventDetail->capacity,
                    ] : null,
                ],
            ])->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'filters' => [
                'categories' => $categories,
                'cities' => $cities,
            ],
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $module = $request->string('module')->toString();

        abort_unless(in_array($module, array_keys(Listing::MODULE_OPTIONS), true), 404);

        $query = Listing::query()
            ->with([
                'category:id,name,slug',
                'city:id,name,slug',
                'images:id,listing_id,image_path,sort_order,is_cover',
                'contractorDetail',
                'propertyDetail',
                'carDetail',
                'eventDetail',
            ])
            ->where('status', 'published')
            ->where('module', $module);

        if ($request->filled('slug')) {
            $query->where('slug', $request->string('slug')->toString());
        }

        $listing = $query->latest('published_at')->latest('id')->firstOrFail();

        $related = Listing::query()
            ->with(['category:id,name,slug', 'city:id,name,slug'])
            ->where('status', 'published')
            ->where('module', $module)
            ->whereKeyNot($listing->id)
            ->latest('published_at')
            ->latest('id')
            ->take(4)
            ->get();

        return response()->json([
            'data' => [
                'id' => $listing->id,
                'title' => $listing->title,
                'slug' => $listing->slug,
                'module' => $listing->module,
                'excerpt' => $listing->excerpt,
                'price' => $listing->display_price,
                'rating' => (float) $listing->rating,
                'reviews_count' => (int) $listing->reviews_count,
                'image_url' => $listing->image_url,
                'category' => [
                    'name' => $listing->category?->name,
                    'slug' => $listing->category?->slug,
                ],
                'city' => [
                    'name' => $listing->city?->name,
                    'slug' => $listing->city?->slug,
                ],
                'images' => $listing->images->map(fn ($image) => [
                    'image_url' => $image->image_url,
                ])->values(),
                'details' => [
                    'contractor' => $listing->contractorDetail ? [
                        'service_area' => $listing->contractorDetail->service_area,
                        'license_number' => $listing->contractorDetail->license_number,
                        'is_verified' => (bool) $listing->contractorDetail->is_verified,
                    ] : null,
                    'property' => $listing->propertyDetail ? [
                        'property_type' => $listing->propertyDetail->property_type,
                        'listing_type' => $listing->propertyDetail->listing_type,
                        'bedrooms' => $listing->propertyDetail->bedrooms,
                        'bathrooms' => $listing->propertyDetail->bathrooms,
                        'area_sqft' => $listing->propertyDetail->area_sqft,
                    ] : null,
                    'car' => $listing->carDetail ? [
                        'year' => $listing->carDetail->year,
                        'mileage' => $listing->carDetail->mileage,
                        'fuel_type' => $listing->carDetail->fuel_type,
                        'transmission' => $listing->carDetail->transmission,
                        'body_type' => $listing->carDetail->body_type,
                    ] : null,
                    'event' => $listing->eventDetail ? [
                        'starts_at' => optional($listing->eventDetail->starts_at)->toIso8601String(),
                        'ends_at' => optional($listing->eventDetail->ends_at)->toIso8601String(),
                        'venue' => $listing->eventDetail->venue,
                        'capacity' => $listing->eventDetail->capacity,
                    ] : null,
                ],
            ],
            'related' => $related->map(fn (Listing $item) => [
                'title' => $item->title,
                'slug' => $item->slug,
                'module' => $item->module,
                'image_url' => $item->image_url,
                'price' => $item->display_price,
                'rating' => (float) $item->rating,
                'reviews_count' => (int) $item->reviews_count,
                'city' => [
                    'name' => $item->city?->name,
                ],
            ])->values(),
        ]);
    }
}
