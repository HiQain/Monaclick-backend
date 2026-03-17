<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\City;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class PublicListingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $module = $request->string('module')->toString();
        $moduleNormalized = strtolower(trim($module));
        $perPage = min(max((int) $request->integer('per_page', 8), 1), 24);
        $budgetMax = (int) $request->integer('budget_max', 0);
        $listingType = strtolower(trim($request->string('listing_type')->toString()));
        $priceMin = (int) $request->integer('price_min', 0);
        $priceMax = (int) $request->integer('price_max', 0);

        $with = [
            'category:id,name,slug',
            'city:id,name,slug',
        ];

        if (Schema::hasTable('car_details') && Schema::hasColumn('car_details', 'year')) {
            $cols = ['listing_id', 'year'];
            if (Schema::hasColumn('car_details', 'condition')) {
                $cols[] = 'condition';
            }
            if (Schema::hasColumn('car_details', 'is_verified')) {
                $cols[] = 'is_verified';
            }
            $with[] = 'carDetail:' . implode(',', $cols);
        }

        if (
            Schema::hasTable('event_details')
            && Schema::hasColumn('event_details', 'starts_at')
            && Schema::hasColumn('event_details', 'ends_at')
            && Schema::hasColumn('event_details', 'venue')
            && Schema::hasColumn('event_details', 'capacity')
        ) {
            $with[] = 'eventDetail:listing_id,starts_at,ends_at,venue,capacity';
        }

        $query = Listing::query()
            ->with($with)
            // Be tolerant to legacy data like "Published" or trailing spaces.
            ->whereRaw('LOWER(TRIM(status)) = ?', ['published']);

        if ($module !== '') {
            $query->whereRaw('LOWER(TRIM(module)) = ?', [$moduleNormalized]);
        }

        if (
            $moduleNormalized === 'real-estate'
            && in_array($listingType, ['rent', 'sale'], true)
            && Schema::hasTable('property_details')
            && Schema::hasColumn('property_details', 'listing_type')
        ) {
            $query->whereHas('propertyDetail', fn ($builder) => $builder->where('listing_type', $listingType));
        }

        if ($request->filled('category')) {
            $category = $request->string('category')->toString();
            $query->whereHas('category', fn ($builder) => $builder->where('slug', $category));
        }

        if ($request->filled('city')) {
            $city = $request->string('city')->toString();
            $query->whereHas('city', fn ($builder) => $builder->where('slug', $city));
        }

          if (
              $moduleNormalized === 'cars'
              && $request->filled('stock')
              && Schema::hasTable('car_details')
              && Schema::hasColumn('car_details', 'year')
          ) {
              $stock = strtolower(trim($request->string('stock')->toString()));
              if (Schema::hasColumn('car_details', 'condition')) {
                  $newYearThreshold = (int) now()->format('Y') - 3;
                  if ($stock === 'new') {
                      $query->whereHas('carDetail', function ($builder) use ($newYearThreshold) {
                          $builder->where(function ($inner) use ($newYearThreshold) {
                              $inner->whereRaw('LOWER(TRIM(`condition`)) LIKE ?', ['new%'])
                                  ->orWhere(function ($fallback) use ($newYearThreshold) {
                                      $fallback->where(function ($missing) {
                                          $missing->whereNull('condition')->orWhereRaw("TRIM(`condition`) = ''");
                                      })->where('year', '>=', $newYearThreshold);
                                  });
                          });
                      });
                  } elseif ($stock === 'used') {
                      $query->whereHas('carDetail', function ($builder) use ($newYearThreshold) {
                          $builder->where(function ($inner) use ($newYearThreshold) {
                              $inner->whereRaw('LOWER(TRIM(`condition`)) LIKE ?', ['used%'])
                                  ->orWhere(function ($fallback) use ($newYearThreshold) {
                                      $fallback->where(function ($missing) {
                                          $missing->whereNull('condition')->orWhereRaw("TRIM(`condition`) = ''");
                                      })->where('year', '<', $newYearThreshold);
                                  });
                          });
                      });
                  }
              } else {
                  $newYearThreshold = (int) now()->format('Y') - 3;
                  if ($stock === 'new') {
                      $query->whereHas('carDetail', fn ($builder) => $builder->where('year', '>=', $newYearThreshold));
                  } elseif ($stock === 'used') {
                      $query->whereHas('carDetail', fn ($builder) => $builder->where('year', '<', $newYearThreshold));
                  }
              }
          }

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());

            if ($term !== '') {
                $query->where(function ($builder) use ($term): void {
                    $builder->where('title', 'like', "%{$term}%")
                        ->orWhere('excerpt', 'like', "%{$term}%")
                        ->orWhere('price', 'like', "%{$term}%")
                        ->orWhereHas('city', function ($cityQuery) use ($term): void {
                            $cityQuery->where('name', 'like', "%{$term}%")
                                ->orWhere('slug', 'like', "%{$term}%");
                        })
                        ->orWhereHas('category', function ($categoryQuery) use ($term): void {
                            $categoryQuery->where('name', 'like', "%{$term}%")
                                ->orWhere('slug', 'like', "%{$term}%");
                        });

                    if (Schema::hasTable('contractor_details') && Schema::hasColumn('contractor_details', 'service_area')) {
                        $builder->orWhereHas('contractorDetail', function ($detailQuery) use ($term): void {
                            $detailQuery->where('service_area', 'like', "%{$term}%");
                        });
                    }

                    if (Schema::hasTable('event_details') && Schema::hasColumn('event_details', 'venue')) {
                        $builder->orWhereHas('eventDetail', function ($detailQuery) use ($term): void {
                            $detailQuery->where('venue', 'like', "%{$term}%");
                        });
                    }
                });
            }
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

        $hasPriceAmount = Schema::hasColumn('listings', 'price_amount');
        if ($hasPriceAmount && $budgetMax > 0) {
            // Numeric budget filter for all modules (used by the budget bar UI).
            $query->whereNotNull('price_amount')->where('price_amount', '<=', $budgetMax);
        }

        if ($hasPriceAmount && $budgetMax <= 0 && ($priceMin > 0 || $priceMax > 0)) {
            $query->whereNotNull('price_amount');
            if ($priceMin > 0) {
                $query->where('price_amount', '>=', $priceMin);
            }
            if ($priceMax > 0) {
                $query->where('price_amount', '<=', $priceMax);
            }
        }

        $featureValues = collect(explode(',', $request->string('features')->toString()))
            ->map(fn (string $value) => trim($value))
            ->filter(fn (string $value) => $value !== '')
            ->values();

        if (Schema::hasColumn('listings', 'features')) {
            foreach ($featureValues as $featureValue) {
                /**
                 * Shared hosting often runs older MySQL/MariaDB versions where JSON_CONTAINS isn't available.
                 * Using a quoted LIKE keeps filtering working across more platforms.
                 */
                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $featureValue);
                $pattern = '%"' . $escaped . '"%';
                $query->whereRaw("features LIKE ? ESCAPE '\\\\'", [$pattern]);
            }
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
            'data' => $paginated->getCollection()->map(function (Listing $listing) {
                $excerpt = (string) ($listing->excerpt ?? '');

                if ($listing->module === 'restaurants') {
                    $decoded = json_decode($excerpt, true);
                    if (is_array($decoded) && ($decoded['_mc_restaurant_v1'] ?? false)) {
                        $cuisine = (string) ($listing->category?->name ?? '');
                        $cityName = (string) ($listing->city?->name ?? '');
                        $bits = array_values(array_filter([
                            $cuisine !== '' ? "{$cuisine} restaurant" : 'Restaurant',
                            $cityName !== '' ? "in {$cityName}" : '',
                        ]));
                        $excerpt = $bits ? (implode(' ', $bits) . '.') : '';
                    }
                }

                return [
                    'id' => $listing->id,
                    'title' => $listing->title,
                    'slug' => $listing->slug,
                    'module' => $listing->module,
                    'excerpt' => $excerpt,
                    'price' => $listing->display_price,
                    'budget_tier' => (int) $listing->budget_tier,
                    'availability_now' => (bool) $listing->availability_now,
                    'features' => (function () use ($listing) {
                        if ($listing->module === 'restaurants') {
                            return [];
                        }

                        $features = array_values($listing->features ?? []);

                        if (
                            $listing->module === 'cars'
                            && $listing->carDetail
                            && Schema::hasColumn('car_details', 'is_verified')
                            && (bool) $listing->carDetail->is_verified
                        ) {
                            $features[] = 'verified';
                        }

                        return array_values(array_unique(array_filter($features)));
                    })(),
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
                        'car' => $listing->carDetail ? [
                            'year' => $listing->carDetail->year,
                            'condition' => Schema::hasColumn('car_details', 'condition') ? $listing->carDetail->condition : null,
                            'is_verified' => Schema::hasColumn('car_details', 'is_verified') ? (bool) $listing->carDetail->is_verified : false,
                        ] : null,
                    ],
                ];
            })->values(),
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
        $moduleNormalized = strtolower(trim($module));

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
            // Tolerate older data variations ("Published", whitespace, etc.)
            ->whereRaw('LOWER(TRIM(status)) = ?', ['published'])
            ->whereRaw('LOWER(TRIM(module)) = ?', [$moduleNormalized]);

        if ($request->filled('slug')) {
            $query->where('slug', $request->string('slug')->toString());
        }

        $listing = $query->latest('published_at')->latest('id')->firstOrFail();

        $excerpt = (string) ($listing->excerpt ?? '');
        $restaurantMeta = null;
        if ($module === 'restaurants') {
            $decoded = json_decode($excerpt, true);
            if (is_array($decoded) && ($decoded['_mc_restaurant_v1'] ?? false)) {
                $restaurantMeta = $decoded;

                // Avoid showing raw JSON in the "About" section if no human description was collected.
                $cuisine = (string) ($listing->category?->name ?? '');
                $cityName = (string) ($listing->city?->name ?? '');
                $bits = array_values(array_filter([$cuisine !== '' ? "{$cuisine} restaurant" : 'Restaurant', $cityName !== '' ? "in {$cityName}" : '']));
                $excerpt = $bits ? (implode(' ', $bits) . '.') : '';
            }
        }

        $related = Listing::query()
            ->with(['category:id,name,slug', 'city:id,name,slug'])
            ->whereRaw('LOWER(TRIM(status)) = ?', ['published'])
            ->whereRaw('LOWER(TRIM(module)) = ?', [$moduleNormalized])
            ->whereKeyNot($listing->id)
            ->latest('published_at')
            ->latest('id')
            ->take(4)
            ->get();

        $extraFeatures = [];
        if ($moduleNormalized === 'cars' && $listing->carDetail) {
            $wizard = is_array($listing->carDetail->wizard_data) ? $listing->carDetail->wizard_data : [];
            $wizardFeatures = $wizard['features'] ?? null;
            if (is_array($wizardFeatures)) {
                $extraFeatures = collect($wizardFeatures)
                    ->map(fn ($v) => trim((string) $v))
                    ->filter()
                    ->values()
                    ->all();
            }
        }

        $features = $moduleNormalized === 'restaurants'
            ? []
            : array_values(array_unique(array_filter(array_merge($listing->features ?? [], $extraFeatures))));

        if ($moduleNormalized === 'cars' && $listing->carDetail && Schema::hasColumn('car_details', 'is_verified') && (bool) $listing->carDetail->is_verified) {
            $features = array_values(array_unique(array_filter(array_merge($features, ['verified']))));
        }

        $propertyWizard = [];
        if ($moduleNormalized === 'real-estate' && $listing->propertyDetail) {
            $propertyWizard = is_array($listing->propertyDetail->wizard_data) ? $listing->propertyDetail->wizard_data : [];
        }

        return response()->json([
            'data' => [
                'id' => $listing->id,
                'title' => $listing->title,
                'slug' => $listing->slug,
                'module' => $listing->module,
                'excerpt' => $excerpt,
                'price' => $listing->display_price,
                'features' => $features,
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
                        'business_hours' => $listing->contractorDetail->business_hours,
                    ] : null,
                    'property' => $listing->propertyDetail ? [
                        'property_type' => $listing->propertyDetail->property_type,
                        'listing_type' => $listing->propertyDetail->listing_type,
                        'bedrooms' => $listing->propertyDetail->bedrooms,
                        'bathrooms' => $listing->propertyDetail->bathrooms,
                        'area_sqft' => $listing->propertyDetail->area_sqft,
                        'floors_total' => $propertyWizard['floors_total'] ?? null,
                        'floor' => $propertyWizard['floor'] ?? null,
                        'total_area' => $propertyWizard['total_area'] ?? ($propertyWizard['total-area'] ?? null),
                        'living_area' => $propertyWizard['living_area'] ?? null,
                        'kitchen_area' => $propertyWizard['kitchen_area'] ?? null,
                        'parking' => $propertyWizard['parking'] ?? null,
                        'district' => $propertyWizard['district'] ?? null,
                        'zip' => $propertyWizard['zip'] ?? null,
                        'address' => $propertyWizard['address'] ?? null,
                        'state' => $propertyWizard['state'] ?? null,
                        'contact_name' => trim(implode(' ', array_filter([(string) ($propertyWizard['fn'] ?? ''), (string) ($propertyWizard['ln'] ?? '')]))),
                        'contact_email' => $propertyWizard['email'] ?? null,
                        'contact_phone' => $propertyWizard['phone'] ?? null,
                    ] : null,
                    'car' => $listing->carDetail ? [
                        'brand' => $listing->carDetail->brand,
                        'model' => $listing->carDetail->model,
                        'condition' => $listing->carDetail->condition,
                        'year' => $listing->carDetail->year,
                        'mileage' => $listing->carDetail->mileage,
                        'radius' => $listing->carDetail->radius,
                        'drive_type' => $listing->carDetail->drive_type,
                        'engine' => $listing->carDetail->engine,
                        'fuel_type' => $listing->carDetail->fuel_type,
                        'transmission' => $listing->carDetail->transmission,
                        'body_type' => $listing->carDetail->body_type,
                        'city_mpg' => $listing->carDetail->city_mpg,
                        'highway_mpg' => $listing->carDetail->highway_mpg,
                        'exterior_color' => $listing->carDetail->exterior_color,
                        'interior_color' => $listing->carDetail->interior_color,
                        'seller_type' => $listing->carDetail->seller_type,
                        'contact_first_name' => $listing->carDetail->contact_first_name,
                        'contact_last_name' => $listing->carDetail->contact_last_name,
                        'contact_email' => $listing->carDetail->contact_email,
                        'contact_phone' => $listing->carDetail->contact_phone,
                        'is_verified' => Schema::hasColumn('car_details', 'is_verified') ? (bool) $listing->carDetail->is_verified : false,
                        'negotiated' => (bool) $listing->carDetail->negotiated,
                        'installments' => (bool) $listing->carDetail->installments,
                        'exchange' => (bool) $listing->carDetail->exchange,
                        'uncleared' => (bool) $listing->carDetail->uncleared,
                        'dealer_ready' => (bool) $listing->carDetail->dealer_ready,
                        'features' => $extraFeatures,
                    ] : null,
                    'event' => $listing->eventDetail ? [
                        'starts_at' => optional($listing->eventDetail->starts_at)->toIso8601String(),
                        'ends_at' => optional($listing->eventDetail->ends_at)->toIso8601String(),
                        'venue' => $listing->eventDetail->venue,
                        'capacity' => $listing->eventDetail->capacity,
                    ] : null,
                    'restaurant' => $restaurantMeta ? [
                        'address' => (string) ($restaurantMeta['address'] ?? ''),
                        'zip_code' => (string) ($restaurantMeta['zip_code'] ?? ''),
                        'country' => (string) ($restaurantMeta['country'] ?? ''),
                        'seating_capacity' => (string) ($restaurantMeta['seating_capacity'] ?? ''),
                        'services' => is_array($restaurantMeta['services'] ?? null) ? array_values($restaurantMeta['services']) : [],
                        'opening_hours' => is_array($restaurantMeta['opening_hours'] ?? null) ? $restaurantMeta['opening_hours'] : [],
                        'contact_name' => (string) ($restaurantMeta['contact_name'] ?? ''),
                        'phone' => (string) ($restaurantMeta['phone'] ?? ''),
                        'email' => (string) ($restaurantMeta['email'] ?? ''),
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
