import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { ThunkExtra } from './thunkExtra';

/**
 * A thunk over the app store. The store types are imported type-only so this module and the store never form a cycle
 * at runtime; it lives here, not in a feature, so feature thunks (`game`, `interaction`, `persistence`) can share it
 * without importing one another.
 */
export type AppThunk<Result = void> = ThunkAction<Result, RootState, ThunkExtra, UnknownAction>;
