<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PropertyDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'listing_id',
        'property_type',
        'bedrooms',
        'bathrooms',
        'area_sqft',
        'listing_type',
    ];

    protected $casts = [
        'bedrooms' => 'integer',
        'bathrooms' => 'integer',
        'area_sqft' => 'integer',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
