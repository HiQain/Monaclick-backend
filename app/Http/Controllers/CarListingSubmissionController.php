<?php

namespace App\Http\Controllers;

use App\Models\CarDetail;
use App\Models\Category;
use App\Models\City;
use App\Models\Listing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class CarListingSubmissionController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $listingId = (int) $request->input('listing_id', 0);
        $existingListing = null;
        if ($listingId > 0 && auth()->check()) {
            $existingListing = Listing::query()
                ->with('carDetail')
                ->where('id', $listingId)
                ->where('user_id', auth()->id())
                ->where('module', 'cars')
                ->first();
        }

        $existingDetail = $existingListing?->carDetail;

        $brand = $this->stringInputOrExisting($request, 'brand', $existingDetail?->brand);
        $model = $this->stringInputOrExisting($request, 'model', $existingDetail?->model);
        $year = $this->stringInputOrExisting($request, 'year', $existingDetail?->year ? (string) $existingDetail->year : null);
        $title = trim((string) $request->input('title', ''));

        if ($title === '') {
            $title = trim(implode(' ', array_filter([$brand, $model, $year])));
        }
        if ($title === '' && $existingListing) {
            $title = (string) $existingListing->title;
        }
        if ($title === '') {
            $title = 'Car Listing';
        }

        // If car catalog tables exist, try to keep model consistent with the selected make slug.
        if ($brand && Schema::hasTable('car_makes') && Schema::hasTable('car_models')) {
            $make = DB::table('car_makes')->where('slug', Str::slug($brand))->orWhere('name', $brand)->first();
            if ($make && $model) {
                $valid = DB::table('car_models')
                    ->where('make_id', $make->id)
                    ->where(function ($q) use ($model) {
                        $q->where('name', $model)->orWhere('slug', Str::slug($model));
                    })
                    ->exists();
                if (!$valid) {
                    $model = null;
                }
            }
        }

        $bodyType = $this->stringInputOrExisting($request, 'body_type', $existingDetail?->body_type, ['body']);
        $categorySlug = Str::slug($bodyType);
        $category = Category::query()
            ->where('module', 'cars')
            ->when($categorySlug !== '', fn ($query) => $query->where('slug', $categorySlug))
            ->first();

        if (! $category && $existingListing) {
            $category = Category::query()
                ->where('id', $existingListing->category_id)
                ->where('module', 'cars')
                ->first();
        }
        if (! $category) {
            $category = Category::query()->where('module', 'cars')->orderBy('sort_order')->first();
        }

        $stateCode = strtoupper(trim((string) $request->input('state', '')));
        if ($stateCode !== '' && preg_match('/^[A-Z]{2}$/', $stateCode) !== 1) {
            $stateCode = '';
        }

        $cityRaw = $this->stringInputOrExisting($request, 'city', $existingListing?->city?->name);
        $citySlug = Str::slug($cityRaw);
        $city = City::query()
            ->when($citySlug !== '', fn ($query) => $query->where('slug', $citySlug))
            ->when($stateCode !== '' && Schema::hasColumn('cities', 'state_code'), fn ($query) => $query->where('state_code', $stateCode))
            ->first();

        if (! $city && $existingListing) {
            $city = City::query()->where('id', $existingListing->city_id)->first();
        }
        if (! $city) {
            if ($citySlug !== '') {
                $payload = [
                    'name' => ucwords(str_replace('-', ' ', $citySlug)),
                    'slug' => $citySlug,
                ];
                if ($stateCode !== '' && Schema::hasColumn('cities', 'state_code')) {
                    $payload['state_code'] = $stateCode;
                }
                if (Schema::hasColumn('cities', 'is_active')) {
                    $payload['is_active'] = true;
                }
                if (Schema::hasColumn('cities', 'sort_order')) {
                    $payload['sort_order'] = (int) City::query()->max('sort_order') + 1;
                }
                $city = City::query()->create($payload);
            } else {
                $city = City::query()->orderBy('sort_order')->first();
            }
        }

        if (! $category || ! $city) {
            return redirect('/add-car?error=missing-taxonomy');
        }

        $slug = $this->makeUniqueSlug($title, 'car-listing', $existingListing?->id);

        $priceRaw = trim((string) $request->input('price', ''));
        $price = $priceRaw !== ''
            ? Listing::normalizePrice($priceRaw)
            : ($existingListing?->price ?: null);
        $priceAmount = $priceRaw !== '' ? (int) preg_replace('/[^\d]/', '', $priceRaw) : null;
        $existingFeatures = is_array($existingListing?->features) ? $existingListing->features : [];
        $existingPromotionTokens = collect($existingFeatures)
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => str_starts_with($value, 'promo-package:') || str_starts_with($value, 'promo-service:'))
            ->values()
            ->all();
        $baseFeatures = collect($existingFeatures)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->reject(fn ($value) => str_starts_with($value, 'promo-package:') || str_starts_with($value, 'promo-service:'))
            ->values()
            ->all();
        $features = $this->normalizeFeatures($request, $baseFeatures);

        $promotionPackage = strtolower(trim((string) $request->input('promotion_package', $request->input('package', ''))));
        $promotionServices = [
            'certify' => $request->boolean('service_certify'),
            'lifts' => $request->boolean('service_lifts'),
            'analytics' => $request->boolean('service_analytics'),
        ];
        $hasPromotionPayload = $promotionPackage !== ''
            || $request->exists('service_certify')
            || $request->exists('service_lifts')
            || $request->exists('service_analytics');

        if ($hasPromotionPayload) {
            if ($promotionPackage !== '') {
                $features[] = 'promo-package:' . $promotionPackage;
            }

            foreach ($promotionServices as $serviceKey => $enabled) {
                if ($enabled) {
                    $features[] = 'promo-service:' . $serviceKey;
                }
            }
        } else {
            $features = array_merge($features, $existingPromotionTokens);
        }

        $features = array_values(array_unique(array_filter(array_map(
            fn ($feature) => trim((string) $feature),
            $features
        ))));

        $amount = (int) preg_replace('/[^\d]/', '', (string) $priceRaw);
        if ($priceRaw === '' && $existingListing) {
            $budgetTier = (int) $existingListing->budget_tier;
        } else {
            $budgetTier = match (true) {
                $amount <= 100 => 1,
                $amount <= 1000 => 2,
                $amount <= 5000 => 3,
                default => 4,
            };
        }

        $status = $request->boolean('draft')
            ? 'draft'
            : (strtolower((string) $request->input('status', 'published')) === 'draft' ? 'draft' : 'published');

        $coverImage = (string) ($existingListing?->image ?: '/finder/assets/img/placeholders/preview-square.svg');
                $request->validate(
            [
                'cover_image' => ['nullable', 'array'],
                'cover_image.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:8192', 'dimensions:max_height=1000'],
            ],
            [
                'cover_image.*.dimensions' => 'Image height 1000px se zyada nahi ho sakti. Recommended: 1200x675 (16:9).',
            ]
        );
        $uploadedImage = $request->file('cover_image');
        if (is_array($uploadedImage)) {
            $uploadedImage = $uploadedImage[0] ?? null;
        }

          if ($uploadedImage instanceof \Illuminate\Http\UploadedFile && $uploadedImage->isValid()) {
             try {
                 $coverImage = $uploadedImage->store('listings/cars', 'public');
             } catch (\Throwable $e) {
                 $ext = preg_replace('/[^a-z0-9]+/i', '', (string) $uploadedImage->getClientOriginalExtension());
                 $filename = Str::random(40) . ($ext !== '' ? ('.' . strtolower($ext)) : '');
                 $coverImage = $uploadedImage->storeAs('listings/cars', $filename, 'public');
             }
          } elseif (! $existingListing) {
              $fallbackImages = [
                 '/finder/assets/img/listings/cars/grid/01.jpg',
                 '/finder/assets/img/listings/cars/grid/02.jpg',
                '/finder/assets/img/listings/cars/grid/03.jpg',
            ];
            $fallbackIndex = (int) (Listing::query()->where('module', 'cars')->count() % count($fallbackImages));
            $coverImage = $fallbackImages[$fallbackIndex];
        }

        $payload = [
            'user_id' => auth()->id(),
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'cars',
            'title' => $title,
            'slug' => $slug,
            'excerpt' => $this->stringInputOrExisting($request, 'description', $existingListing?->excerpt) ?: '',
            'price' => $price,
            'budget_tier' => $budgetTier,
            'availability_now' => true,
            'features' => $features,
            'rating' => $existingListing?->rating ?? 0,
            'reviews_count' => $existingListing?->reviews_count ?? 0,
            'image' => $coverImage,
            'status' => $status,
            'published_at' => $status === 'published'
                ? ($existingListing?->published_at ?: Carbon::now())
                : null,
        ];

        if (Schema::hasColumn('listings', 'price_amount')) {
            $payload['price_amount'] = $priceAmount && $priceAmount > 0 ? $priceAmount : null;
        }

        if ($existingListing) {
            $existingListing->fill($payload)->save();
            $listing = $existingListing;
        } else {
            $listing = Listing::query()->create($payload);
        }

        $wizardData = [
            'brand' => $brand,
            'model' => $model,
            'condition' => $this->stringInputOrExisting($request, 'condition', $existingDetail?->condition),
            'year' => $this->integerInputOrExisting($request, 'year', $existingDetail?->year),
            'city' => (string) ($city->name ?? ''),
            'mileage' => $this->integerInputOrExisting($request, 'mileage', $existingDetail?->mileage),
            'radius' => $this->stringInputOrExisting($request, 'radius', $existingDetail?->radius),
            'drive_type' => $this->stringInputOrExisting($request, 'drive_type', $existingDetail?->drive_type),
            'engine' => $this->stringInputOrExisting($request, 'engine', $existingDetail?->engine),
            'fuel_type' => $this->lowerStringInputOrExisting($request, 'fuel_type', $existingDetail?->fuel_type),
            'transmission' => $this->lowerStringInputOrExisting($request, 'transmission', $existingDetail?->transmission),
            'body_type' => $bodyType,
            'city_mpg' => $this->integerInputOrExisting($request, 'city_mpg', $existingDetail?->city_mpg),
            'highway_mpg' => $this->integerInputOrExisting($request, 'highway_mpg', $existingDetail?->highway_mpg),
            'exterior_color' => $this->stringInputOrExisting($request, 'exterior_color', $existingDetail?->exterior_color),
            'interior_color' => $this->stringInputOrExisting($request, 'interior_color', $existingDetail?->interior_color),
            'description' => $this->stringInputOrExisting($request, 'description', $existingListing?->excerpt) ?: '',
            'seller_type' => $this->stringInputOrExisting($request, 'seller_type', $existingDetail?->seller_type, ['seller']),
            'contact_first_name' => $this->stringInputOrExisting($request, 'contact_first_name', $existingDetail?->contact_first_name),
            'contact_last_name' => $this->stringInputOrExisting($request, 'contact_last_name', $existingDetail?->contact_last_name),
            'contact_email' => $this->stringInputOrExisting($request, 'contact_email', $existingDetail?->contact_email),
            'contact_phone' => $this->stringInputOrExisting($request, 'contact_phone', $existingDetail?->contact_phone),
            'negotiated' => $this->booleanInputOrExisting($request, 'negotiated', (bool) ($existingDetail?->negotiated ?? false)),
            'installments' => $this->booleanInputOrExisting($request, 'installments', (bool) ($existingDetail?->installments ?? false)),
            'exchange' => $this->booleanInputOrExisting($request, 'exchange', (bool) ($existingDetail?->exchange ?? false)),
            'uncleared' => $this->booleanInputOrExisting($request, 'uncleared', (bool) ($existingDetail?->uncleared ?? false)),
            'dealer_ready' => $this->booleanInputOrExisting($request, 'dealer_ready', (bool) ($existingDetail?->dealer_ready ?? false)),
            'price' => $priceRaw !== '' ? $priceRaw : preg_replace('/[^\d]/', '', (string) ($existingListing?->price ?? '')),
            'features' => $features,
        ];

        CarDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'brand' => $wizardData['brand'],
                'model' => $wizardData['model'],
                'condition' => $wizardData['condition'],
                'year' => $wizardData['year'],
                'mileage' => $wizardData['mileage'],
                'radius' => $wizardData['radius'],
                'drive_type' => $wizardData['drive_type'],
                'engine' => $wizardData['engine'],
                'fuel_type' => $wizardData['fuel_type'],
                'transmission' => $wizardData['transmission'],
                'body_type' => $wizardData['body_type'],
                'city_mpg' => $wizardData['city_mpg'],
                'highway_mpg' => $wizardData['highway_mpg'],
                'exterior_color' => $wizardData['exterior_color'],
                'interior_color' => $wizardData['interior_color'],
                'seller_type' => $wizardData['seller_type'],
                'contact_first_name' => $wizardData['contact_first_name'],
                'contact_last_name' => $wizardData['contact_last_name'],
                'contact_email' => $wizardData['contact_email'],
                'contact_phone' => $wizardData['contact_phone'],
                'negotiated' => $wizardData['negotiated'],
                'installments' => $wizardData['installments'],
                'exchange' => $wizardData['exchange'],
                'uncleared' => $wizardData['uncleared'],
                'dealer_ready' => $wizardData['dealer_ready'],
                'wizard_data' => $wizardData,
            ]
        );

        if ($status === 'draft') {
            $nextPath = trim((string) $request->input('next', ''));
            if ($nextPath !== '' && str_starts_with($nextPath, '/add-car-promotion')) {
                return redirect($nextPath . '?edit=' . $listing->id);
            }

            return redirect('/account/listings?saved=draft&edit=' . $listing->id);
        }

        if (! empty($listing->slug)) {
            return redirect('/entry/cars?created=1&slug=' . urlencode((string) $listing->slug));
        }

        return redirect('/listings/cars?created=1');
    }

    private function makeUniqueSlug(string $title, string $fallback, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($title);
        if ($baseSlug === '') {
            $baseSlug = $fallback;
        }

        $slug = $baseSlug;
        $suffix = 2;

        while (
            Listing::query()
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = "{$baseSlug}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    /**
     * @param array<int, string> $aliases
     */
    private function stringInputOrExisting(Request $request, string $key, ?string $existing = null, array $aliases = []): ?string
    {
        $keys = array_merge([$key], $aliases);
        foreach ($keys as $candidate) {
            if (! $request->exists($candidate)) {
                continue;
            }
            $value = trim((string) $request->input($candidate, ''));
            if ($value !== '') {
                return $value;
            }
        }

        return $existing !== null && trim($existing) !== '' ? trim($existing) : null;
    }

    private function lowerStringInputOrExisting(Request $request, string $key, ?string $existing = null): ?string
    {
        $value = $this->stringInputOrExisting($request, $key, $existing);

        return $value !== null ? Str::lower($value) : null;
    }

    private function integerInputOrExisting(Request $request, string $key, ?int $existing = null): ?int
    {
        if ($request->exists($key)) {
            $numeric = preg_replace('/[^\d]/', '', (string) $request->input($key, ''));
            if ($numeric !== '') {
                return (int) $numeric;
            }
        }

        return $existing;
    }

    private function booleanInputOrExisting(Request $request, string $key, bool $existing = false): bool
    {
        if (! $request->exists($key)) {
            return $existing;
        }

        return $request->boolean($key);
    }

    /**
     * @param array<int, string> $existingFeatures
     * @return array<int, string>
     */
    private function normalizeFeatures(Request $request, array $existingFeatures = []): array
    {
        $legacy = $request->input('car_features', []);
        if (is_string($legacy)) {
            $legacy = [$legacy];
        }
        $legacyFeatures = is_array($legacy)
            ? collect($legacy)->map(fn ($v) => trim((string) $v))->filter()->values()->all()
            : [];

        if ($request->exists('features_json')) {
            $featuresRaw = (string) $request->input('features_json', '[]');
            $decoded = json_decode($featuresRaw, true);
            $features = is_array($decoded)
                ? collect($decoded)->map(fn ($v) => trim((string) $v))->filter()->values()->all()
                : [];

            // If client-side JSON stayed empty, fall back to checkbox-submitted values.
            if (!count($features) && count($legacyFeatures)) {
                return $legacyFeatures;
            }

            return $features;
        }

        if (count($legacyFeatures)) {
            return $legacyFeatures;
        }

        return array_values(array_filter(array_map(
            fn ($feature) => trim((string) $feature),
            $existingFeatures
        )));
    }
}
