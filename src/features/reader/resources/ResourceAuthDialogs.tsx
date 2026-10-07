import { useCallback, useSyncExternalStore } from 'react'

import { auth, remote, toErrorPayload } from '../../../services'
import type { ErrorPayload } from '../../../services/types'
import { AuthScopeDialog } from '../../settings/dialogs/AuthScopeDialog'
import { resourceInvalidation } from '../view/resource-invalidation'
import { RemoteImageDialog } from './RemoteImageDialog'
import { resourceAuth, type LocalResourcePrompt, type RemoteResourcePrompt } from './resource-auth'

/**
 * Authorization dialog host (T-57/T-58; ui-spec §3.8; models §8).
 *
 * Bridges the aggregation store to the two commands that carry the user's
 * decision — `grant_local_root` (session by default, persistent only when the
 * checkbox asked for it) and `grant_remote_session` (always session-scoped) —
 * and re-resolves the document's resources on success, so allowed images
 * replace their placeholders.
 *
 * A failed grant is surfaced through `onError` and blocks the scope like a
 * denial: the placeholder stays and the user decides again explicitly
 * (INV-AZ-05) — there is no automatic retry loop.
 */

export interface ResourceAuthDialogsProps {
  onError(error: ErrorPayload): void
}

export function ResourceAuthDialogs({ onError }: ResourceAuthDialogsProps) {
  const prompt = useSyncExternalStore(
    (listener) => resourceAuth.subscribe(listener),
    () => resourceAuth.getSnapshot(),
    () => null,
  )

  const allowLocal = useCallback(
    async (request: LocalResourcePrompt, persist: boolean) => {
      try {
        await auth.grantLocalRoot({
          docId: request.docId,
          rootPath: request.rootPath,
          persist,
        })
      } catch (error) {
        resourceAuth.blockPrompt(request.id)
        onError(toErrorPayload(error))
        return
      }
      resourceAuth.resolvePrompt(request.id)
      resourceAuth.markLocalGranted(request.docId, request.rootPath)
      resourceInvalidation.bump(request.docId)
    },
    [onError],
  )

  const allowRemote = useCallback(
    async (request: RemoteResourcePrompt) => {
      try {
        await remote.grantRemoteSession({
          docId: request.docId,
          origins: [...request.origins],
        })
      } catch (error) {
        resourceAuth.blockPrompt(request.id)
        onError(toErrorPayload(error))
        return
      }
      resourceAuth.resolvePrompt(request.id)
      resourceAuth.markRemoteGranted(request.docId, request.origins)
      resourceInvalidation.bump(request.docId)
    },
    [onError],
  )

  const block = useCallback((id: string) => {
    resourceAuth.blockPrompt(id)
  }, [])

  if (prompt === null) return null
  if (prompt.kind === 'local') {
    return (
      <AuthScopeDialog
        scopePath={prompt.rootPath}
        resourceCount={prompt.resourceCount}
        onAllow={(persist) => void allowLocal(prompt, persist)}
        onBlock={() => block(prompt.id)}
      />
    )
  }
  // Defensive: an origin-less remote prompt cannot be confirmed (no scope to
  // name), so it renders the title/hint only through the same dialog.
  return (
    <RemoteImageDialog
      origins={prompt.origins}
      onAllow={() => void allowRemote(prompt)}
      onBlock={() => block(prompt.id)}
    />
  )
}
