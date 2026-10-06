import { invokeCommand } from './invoke'

import type { DirectoryListing, DirectoryRoot, OpenDirectoryRequest, ReadDirectoryRequest } from './types'

/** Directory tree service (contracts §8): commands 9–10. */

export function openDirectory(req: OpenDirectoryRequest): Promise<DirectoryRoot> {
  return invokeCommand<DirectoryRoot>('open_directory', { req })
}

export function readDirectory(req: ReadDirectoryRequest): Promise<DirectoryListing> {
  return invokeCommand<DirectoryListing>('read_directory', { req })
}
