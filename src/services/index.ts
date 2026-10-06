/**
 * Service layer barrel: the only import surface for features (contracts §8).
 *
 * Namespaces mirror the contract command index (`files.*`, `tree.*`,
 * `search.*`, `watch.*`, `storage.*`, `settings.*`, `auth.*`, `remote.*`,
 * `opener.*`, `diagnostics.*`, `app.*`; `clipboard` is a plugin wrapper).
 * `resources.ts` is exported as the `remote` namespace per contract §2/§8.
 */

export * as app from './app'
export * as auth from './auth'
export * as clipboard from './clipboard'
export * as diagnostics from './diagnostics'
export * as events from './events'
export * as files from './files'
export * as opener from './opener'
export * as remote from './resources'
export * as search from './search'
export * as settings from './settings'
export * as storage from './storage'
export * as tree from './tree'
export * as watch from './watch'

export * from './invoke'
export * from './types'
