<?php

namespace App\Filament\Resources\Listings\Pages;

use App\Filament\Resources\Listings\ListingResource;
use App\Filament\Resources\Listings\Pages\Concerns\HandlesListingDetails;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditListing extends EditRecord
{
    use HandlesListingDetails;

    protected static string $resource = ListingResource::class;

    protected array $listingFormData = [];

    protected function mutateFormDataBeforeFill(array $data): array
    {
        return $this->mutateListingDetailFormDataBeforeFill($data);
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        $data = $this->normalizePriceForListing($data);

        $status = (string) ($data['status'] ?? 'draft');

        if ($status === 'published' && blank($data['published_at'] ?? null)) {
            $data['published_at'] = now();
        }

        if ($status === 'draft') {
            $data['published_at'] = null;
        }

        $this->listingFormData = $data;
        $this->assertPublishRequirements($data);

        return $this->stripExtraFormData($data);
    }

    protected function afterSave(): void
    {
        $this->syncListingRelations($this->listingFormData);
    }

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
