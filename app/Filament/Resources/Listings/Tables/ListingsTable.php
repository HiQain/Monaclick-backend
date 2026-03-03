<?php

namespace App\Filament\Resources\Listings\Tables;

use App\Models\Listing;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\BulkAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ListingsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('user.name')
                    ->searchable(),
                TextColumn::make('category.name')
                    ->searchable(),
                TextColumn::make('city.name')
                    ->searchable(),
                TextColumn::make('module')
                    ->badge()
                    ->sortable()
                    ->searchable(),
                TextColumn::make('title')
                    ->sortable()
                    ->searchable(),
                TextColumn::make('slug')
                    ->copyable()
                    ->searchable(),
                TextColumn::make('price')
                    ->searchable(),
                TextColumn::make('rating')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('reviews_count')
                    ->numeric()
                    ->sortable(),
                ImageColumn::make('image')
                    ->disk('public'),
                TextColumn::make('status')
                    ->badge(),
                TextColumn::make('published_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('module')
                    ->options(Listing::MODULE_OPTIONS),
                SelectFilter::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'published' => 'Published',
                    ]),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    BulkAction::make('publishSelected')
                        ->label('Publish selected')
                        ->icon('heroicon-o-check')
                        ->requiresConfirmation()
                        ->action(function ($records): void {
                            $now = now();
                            foreach ($records as $record) {
                                $record->update([
                                    'status' => 'published',
                                    'published_at' => $record->published_at ?? $now,
                                ]);
                            }
                        }),
                    BulkAction::make('moveToDraft')
                        ->label('Move to draft')
                        ->icon('heroicon-o-pencil-square')
                        ->requiresConfirmation()
                        ->action(function ($records): void {
                            foreach ($records as $record) {
                                $record->update([
                                    'status' => 'draft',
                                    'published_at' => null,
                                ]);
                            }
                        }),
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
