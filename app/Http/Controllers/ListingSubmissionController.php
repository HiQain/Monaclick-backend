<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\City;
use App\Models\ContractorDetail;
use App\Models\Listing;
use App\Models\ListingImage;
use App\Models\PropertyDetail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;

class ListingSubmissionController extends Controller
{
    public function property(Request $request): RedirectResponse
    {
        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'real-estate');
        $existingWizardData = is_array($editListing?->propertyDetail?->wizard_data)
            ? $editListing->propertyDetail->wizard_data
            : [];
        $wizardData = array_merge($existingWizardData, $payload);
        $wizardSession = trim((string) ($wizardData['wizard_session'] ?? ''));
        $wizardSessionMapKey = null;
        if (auth()->check() && $wizardSession !== '') {
            $wizardSessionMapKey = 'property-wizard-map:' . auth()->id() . ':' . md5($wizardSession);
            if (! $editListing) {
                $mappedListingId = (int) Cache::get($wizardSessionMapKey, 0);
                if ($mappedListingId > 0) {
                    $mappedListing = Listing::query()
                        ->where('id', $mappedListingId)
                        ->where('user_id', auth()->id())
                        ->where('module', 'real-estate')
                        ->first();
                    if ($mappedListing) {
                        $editListing = $mappedListing;
                    }
                }
            }
        }
        $inFlightDraftLockKey = null;
        if ($status === 'draft' && ! $editListing && auth()->check() && $wizardSession !== '') {
            $inFlightDraftLockKey = 'property-draft-inflight:' . auth()->id() . ':' . md5($wizardSession);
            if (! Cache::add($inFlightDraftLockKey, 1, now()->addSeconds(20))) {
                return redirect('/account/listings?saved=draft');
            }
        }
        if (! $editListing && $status === 'draft' && $wizardSession !== '' && auth()->check()) {
            $sessionDraft = Listing::query()
                ->where('user_id', auth()->id())
                ->where('module', 'real-estate')
                ->where('status', 'draft')
                ->whereHas('propertyDetail', function ($query) use ($wizardSession) {
                    $query->where('wizard_data->wizard_session', $wizardSession);
                })
                ->latest('id')
                ->first();
            if ($sessionDraft) {
                $editListing = $sessionDraft;
            }
        }

        $categorySlug = $this->mapPropertyCategorySlug((string) ($wizardData['radio:type'] ?? ''));
        $category = $this->resolveCategory('real-estate', $categorySlug);
        $city = $this->resolveCity($this->firstNonEmpty($wizardData, [
            'select:city-select',
            'select:location-select',
            'select:city',
            'city-select',
            'city',
        ]));
        if (! $city && $editListing?->city) {
            $city = $editListing->city;
        }

        if (! $category || ! $city) {
            return redirect('/add-property?error=missing-taxonomy');
        }

        $title = trim(implode(' ', array_filter([
            (string) ($wizardData['radio:type'] ?? ''),
            (string) ($wizardData['address'] ?? ''),
            (string) ($wizardData['zip'] ?? ''),
        ])));

        if ($title === '' && $editListing) {
            $title = (string) $editListing->title;
        }
        if ($title === '') {
            $title = 'Property Listing';
        }

        $draftLockKey = null;
        if ($status === 'draft' && ! $editListing && auth()->check()) {
            $payloadHash = md5(json_encode($wizardData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
            $draftLockKey = 'property-draft-lock:' . auth()->id() . ':' . $payloadHash;
            $lockedId = (int) Cache::get($draftLockKey, 0);
            if ($lockedId > 0) {
                $lockedListing = Listing::query()
                    ->where('id', $lockedId)
                    ->where('user_id', auth()->id())
                    ->where('module', 'real-estate')
                    ->first();
                if ($lockedListing) {
                    $editListing = $lockedListing;
                }
            }
        }

        $listingType = ((string) ($wizardData['radio:category'] ?? ($existingWizardData['radio:category'] ?? 'sell'))) === 'rent' ? 'rent' : 'sale';
        $priceRaw = (string) ($wizardData['price'] ?? ($existingWizardData['price'] ?? ''));
        $price = Listing::normalizePrice($priceRaw !== '' ? $priceRaw : null, $listingType === 'rent');
        $excerpt = $this->firstNonEmpty($wizardData, [
            'user-info',
            'description',
            'details',
        ]);
        if ($excerpt === '' && $editListing) {
            $excerpt = (string) ($editListing->excerpt ?? '');
        }
        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'real-estate',
            'title' => $title,
            'excerpt' => $excerpt,
            'price' => $price,
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => (bool) ($wizardData['tour'] ?? ($editListing?->availability_now ?? false)),
            'features' => $editListing?->features ?? [],
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published'
                ? ($editListing?->published_at ?: Carbon::now())
                : null,
        ];

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing', $editListing->id);
            $listingData['image'] = $editListing->image ?: '/finder/assets/img/listings/real-estate/03.jpg';
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $recentDraft = null;
            if ($status === 'draft' && auth()->check()) {
                $recentDraft = Listing::query()
                    ->where('user_id', auth()->id())
                    ->where('module', 'real-estate')
                    ->where('status', 'draft')
                    ->where('title', $title)
                    ->where('created_at', '>=', Carbon::now()->subMinutes(5))
                    ->latest('id')
                    ->first();
            }

            if ($recentDraft) {
                $listingData['slug'] = $recentDraft->slug ?: $this->makeUniqueSlug($title, 'property-listing', $recentDraft->id);
                $listingData['user_id'] = auth()->id();
                $listingData['image'] = $recentDraft->image ?: '/finder/assets/img/listings/real-estate/03.jpg';
                $recentDraft->update($listingData);
                $listing = $recentDraft->fresh(['city']);
            } else {
                $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing');
                $listingData['user_id'] = auth()->id();
                $listingData['image'] = '/finder/assets/img/listings/real-estate/03.jpg';
                $listing = Listing::query()->create($listingData);
            }
        }

        PropertyDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'property_type' => $this->mapPropertyType((string) ($wizardData['radio:type'] ?? '')),
                'bedrooms' => $this->extractCount((string) ($wizardData['radio:bedrooms'] ?? '')),
                'bathrooms' => $this->extractCount((string) ($wizardData['radio:bathrooms'] ?? '')),
                'area_sqft' => $this->normalizeInteger((string) ($wizardData['total-area'] ?? '')),
                'listing_type' => $listingType,
                'wizard_data' => $wizardData,
            ]
        );

        if ($request->hasFile('photos')) {
            $files = $request->file('photos');
            if (! is_array($files)) {
                $files = [$files];
            }
            $stored = [];
            foreach ($files as $idx => $file) {
                if (! $file) {
                    continue;
                }
                $path = $file->store('listings/properties', 'public');
                $stored[] = $path;
                ListingImage::query()->create([
                    'listing_id' => $listing->id,
                    'image_path' => $path,
                    'sort_order' => (int) $idx,
                    'is_cover' => $idx === 0,
                ]);
            }
            if (count($stored) > 0) {
                $listing->image = $stored[0];
                $listing->save();
            }
        }

        if ($draftLockKey && $status === 'draft') {
            Cache::put($draftLockKey, $listing->id, now()->addMinutes(2));
        }
        if ($wizardSessionMapKey) {
            Cache::put($wizardSessionMapKey, $listing->id, now()->addHours(12));
        }
        if ($inFlightDraftLockKey) {
            Cache::forget($inFlightDraftLockKey);
        }

        $nextPath = trim((string) $request->input('next', ''));
        if ($status === 'draft' && $nextPath !== '' && str_starts_with($nextPath, '/add-property')) {
            return redirect($nextPath . '?edit=' . $listing->id);
        }

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/listings/real-estate',
            $title,
            $listing->id
        );
    }

    public function contractor(Request $request): RedirectResponse
    {
        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'contractors');

        $selectedCategory = $this->firstNonEmpty($payload, [
            'select:select-categories',
            'select:project-type',
            'project-type',
            'radio:project-type',
            'category',
        ]);
        $category = $this->resolveCategory('contractors', $selectedCategory !== '' ? $selectedCategory : 'Remodeling');
        $city = $this->resolveCity($this->firstNonEmpty($payload, [
            'select:city-select',
            'select:location-select',
            'select:city',
            'city-select',
            'city',
        ]));

        if (! $category || ! $city) {
            return redirect('/add-contractor?error=missing-taxonomy');
        }

        $projectName = trim((string) ($payload['project-name'] ?? ''));
        $title = $projectName !== '' ? $projectName : ucfirst(str_replace('-', ' ', $category->slug)) . ' Service';
        $priceRaw = (string) ($payload['price'] ?? '');
        $features = ['verified-hires'];
        if (($payload['home-renovations'] ?? false) || ($payload['custom-home-building'] ?? false)) {
            $features[] = 'free-estimate';
        }
        if (($payload['architectural-design'] ?? false) || ($payload['bathroom-design'] ?? false)) {
            $features[] = 'free-consultation';
        }
        if (($payload['monday'] ?? false) && ($payload['saturday'] ?? false || $payload['sunday'] ?? false)) {
            $features[] = 'weekend-consultations';
        }

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'contractors',
            'title' => $title,
            'excerpt' => $this->firstNonEmpty($payload, [
                'project-description',
                'user-info',
                'description',
            ]),
            'price' => Listing::normalizePrice($priceRaw !== '' ? "From {$priceRaw}" : null),
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service', $editListing->id);
            $listingData['image'] = $editListing->image ?: '/finder/assets/img/listings/contractors/03.jpg';
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = '/finder/assets/img/listings/contractors/03.jpg';
            $listing = Listing::query()->create($listingData);
        }

        $serviceArea = trim(implode(', ', array_filter([
            (string) ($payload['address'] ?? ''),
            (string) ($payload['zip'] ?? ''),
            (string) ($payload['area-search'] ?? ''),
        ])));

        $businessHours = [
            'monday' => (bool) ($payload['monday'] ?? false),
            'tuesday' => (bool) ($payload['tuesday'] ?? false),
            'wednesday' => (bool) ($payload['wednesday'] ?? false),
            'thursday' => (bool) ($payload['thursday'] ?? false),
            'friday' => (bool) ($payload['friday'] ?? false),
            'saturday' => (bool) ($payload['saturday'] ?? false),
            'sunday' => (bool) ($payload['sunday'] ?? false),
        ];

        ContractorDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'service_area' => $serviceArea !== '' ? $serviceArea : ($city->name . ' Metro'),
                'license_number' => $this->firstNonEmpty($payload, ['license-number', 'license_number', 'license']) ?: null,
                'is_verified' => (bool) ($payload['is-verified'] ?? false),
                'business_hours' => $businessHours,
            ]
        );

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/account/listings',
            $title,
            $listing->id
        );
    }

    public function restaurant(Request $request): RedirectResponse
    {
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'restaurants');

        $title = trim((string) $request->input('restaurant_name', ''));
        if ($title === '') {
            $title = 'Restaurant Listing';
        }

        $category = $this->resolveCategory('restaurants', (string) $request->input('cuisine_type', ''));
        $city = $this->resolveCity((string) $request->input('city', ''));

        if (! $category || ! $city) {
            return redirect('/add-restaurant?error=missing-taxonomy');
        }

        $priceRange = trim((string) $request->input('price_range', ''));
        $price = $priceRange !== '' ? "{$priceRange} avg" : null;
        $services = $request->input('services', []);

        if (is_string($services)) {
            $services = [$services];
        }

        $serviceValues = collect($services)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->values()
            ->all();

        $features = ['eco-friendly'];
        if (in_array('reservations', $serviceValues, true)) {
            $features[] = 'free-consultation';
        }
        if (in_array('delivery', $serviceValues, true)) {
            $features[] = 'online-consultation';
        }
        if (in_array('family friendly', $serviceValues, true) || in_array('family-friendly', $serviceValues, true)) {
            $features[] = 'weekend-consultations';
        }

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'restaurants',
            'title' => $title,
            'excerpt' => trim((string) $request->input('description', $request->input('about', ''))),
            'price' => $price,
            'budget_tier' => $this->resolveRestaurantBudgetTier($priceRange),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        $uploadedImagePath = null;
        if ($request->hasFile('cover_photo')) {
            $uploadedImagePath = $request->file('cover_photo')?->store('listings/restaurants', 'public');
        }

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing', $editListing->id);
            $listingData['image'] = $uploadedImagePath ?: ($editListing->image ?: '/finder/assets/img/monaclick/restaurants/user1.jpg');
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = $uploadedImagePath ?: '/finder/assets/img/monaclick/restaurants/user1.jpg';
            $listing = Listing::query()->create($listingData);
        }

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/account/listings',
            $listing->title,
            $listing->id
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function decodePayload(Request $request): array
    {
        $encoded = trim((string) $request->input('payload', $request->query('payload', '')));
        if ($encoded === '') {
            return [];
        }

        $decoded = base64_decode($encoded, true);
        if ($decoded === false) {
            return [];
        }

        $payload = json_decode($decoded, true);

        return is_array($payload) ? $payload : [];
    }

    private function resolveStatus(Request $request): string
    {
        $draft = (string) ($request->input('draft', $request->query('draft', '')));
        if ($draft === '1') {
            return 'draft';
        }

        return 'published';
    }

    private function resolveEditableListing(Request $request, string $module): ?Listing
    {
        $listingId = (int) $request->input('listing_id', $request->query('listing_id', 0));
        if ($listingId <= 0) {
            return null;
        }

        return Listing::query()
            ->where('id', $listingId)
            ->where('module', $module)
            ->where('user_id', auth()->id())
            ->first();
    }

    private function resolveCategory(string $module, string $rawValue): ?Category
    {
        $slug = Str::slug($rawValue);
        $name = trim((string) $rawValue);

        $query = Category::query()->where('module', $module);

        if ($slug !== '') {
            $category = (clone $query)->where('slug', $slug)->first();
            if ($category) {
                return $category;
            }

            $category = (clone $query)->where('name', 'like', '%' . $rawValue . '%')->first();
            if ($category) {
                return $category;
            }
        }

        $fallback = (clone $query)->orderBy('sort_order')->first();
        if ($fallback) {
            return $fallback;
        }

        $generatedSlug = $slug !== '' ? $slug : Str::slug($module . '-general');
        $generatedName = $name !== '' ? $name : ucfirst(str_replace('-', ' ', $module)) . ' General';

        return Category::query()->create([
            'module' => $module,
            'name' => $generatedName,
            'slug' => $generatedSlug,
            'sort_order' => (int) Category::query()->where('module', $module)->max('sort_order') + 1,
            'is_active' => true,
        ]);
    }

    private function resolveCity(string $rawValue): ?City
    {
        $rawValue = trim($rawValue);
        $slug = Str::slug($rawValue);

        if ($slug !== '') {
            $city = City::query()->where('slug', $slug)->first();
            if ($city) {
                return $city;
            }

            return City::query()->create([
                'name' => ucwords(str_replace('-', ' ', $slug)),
                'slug' => $slug,
                'is_active' => true,
                'sort_order' => (int) City::query()->max('sort_order') + 1,
            ]);
        }

        return City::query()->orderBy('sort_order')->first();
    }

    private function mapPropertyCategorySlug(string $type): string
    {
        return match (Str::slug($type)) {
            'apartment' => 'apartments',
            'house' => 'family-homes',
            'commercial' => 'commercial-spaces',
            'room' => 'townhouses',
            'garage' => 'condos',
            default => 'family-homes',
        };
    }

    private function mapPropertyType(string $type): string
    {
        return match (Str::slug($type)) {
            'commercial' => 'Commercial',
            default => 'Residential',
        };
    }

    private function mapContractorCategorySlug(?string $selectedCategory): string
    {
        return match (Str::slug((string) $selectedCategory)) {
            'roofing' => 'roofing',
            'plumbing' => 'plumbing',
            'electrician', 'electrical' => 'electrical',
            'painting', 'paiting' => 'painting',
            default => 'remodeling',
        };
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<int, string> $keys
     */
    private function firstNonEmpty(array $payload, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $payload[$key] ?? null;
            if (is_array($value)) {
                $value = $this->extractFirstValue($value);
            }
            $value = trim((string) $value);
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function resolveBudgetTier(string $rawAmount): int
    {
        $amount = $this->normalizeInteger($rawAmount);

        return match (true) {
            $amount <= 100 => 1,
            $amount <= 1000 => 2,
            $amount <= 5000 => 3,
            default => 4,
        };
    }

    private function resolveRestaurantBudgetTier(string $priceRange): int
    {
        $len = strlen(trim($priceRange));

        return match (true) {
            $len <= 1 => 1,
            $len === 2 => 2,
            $len === 3 => 3,
            default => 4,
        };
    }

    private function normalizeInteger(string $value): int
    {
        return (int) preg_replace('/[^\d]/', '', $value);
    }

    private function extractCount(string $value): ?int
    {
        if ($value === '' || Str::endsWith($value, '-any')) {
            return null;
        }

        $count = $this->normalizeInteger($value);

        return $count > 0 ? $count : null;
    }

    /**
     * @param mixed $value
     */
    private function extractFirstValue($value): string
    {
        if (is_array($value)) {
            return trim((string) ($value[0] ?? ''));
        }

        return trim((string) $value);
    }

    private function makeUniqueSlug(string $title, string $fallback, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($title);
        if ($baseSlug === '') {
            $baseSlug = $fallback;
        }

        $slug = $baseSlug;
        $counter = 2;

        while (Listing::query()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function redirectAfterSubmission(string $status, string $draftPath, string $publishedPath, string $title, ?int $listingId = null): RedirectResponse
    {
        if ($status === 'draft') {
            $qs = $listingId ? ('?saved=draft&edit=' . $listingId) : '?saved=draft';
            return redirect($draftPath . $qs);
        }

        return redirect($publishedPath . '?created=1&q=' . urlencode($title));
    }
}
