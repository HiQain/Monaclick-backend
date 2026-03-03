<?php

namespace App\Filament\Resources\Categories\Schemas;

use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class CategoryForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('slug')
                    ->required()
                    ->maxLength(255)
                    ->helperText('Leave as-is to auto-update from name. You can also set custom slug.'),
                Select::make('module')
                    ->required()
                    ->options([
                        'contractors' => 'Contractors',
                        'real-estate' => 'Real Estate',
                        'cars' => 'Cars',
                        'events' => 'Events',
                    ]),
                TextInput::make('icon')
                    ->maxLength(100)
                    ->helperText('Optional icon class, e.g. fi fi-tools'),
                FileUpload::make('image')
                    ->label('Category Image')
                    ->image()
                    ->disk('public')
                    ->directory('categories')
                    ->imageEditor(),
                Toggle::make('is_active')
                    ->default(true)
                    ->required(),
                TextInput::make('sort_order')
                    ->required()
                    ->numeric()
                    ->default(0),
            ]);
    }
}
