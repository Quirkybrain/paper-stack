import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'

import * as app from './app'
import * as auth from './auth'
import * as clipboard from './clipboard'
import * as diagnostics from './diagnostics'
import * as files from './files'
import * as opener from './opener'
import * as remote from './resources'
import * as search from './search'
import * as settings from './settings'
import * as storage from './storage'
import * as tree from './tree'
import * as watch from './watch'
import type { ErrorPayload } from './types'

const invokeMock = vi.mocked(invoke)

const internalError: ErrorPayload = {
  code: 'PS_INTERNAL',
  category: 'internal',
  messageKey: 'error.internal.unexpected',
  retryable: true,
}

describe('service wrappers mirror the contract command surface', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
  })

  it('files commands (1–8)', async () => {
    await files.pickFiles()
    expect(invokeMock).toHaveBeenLastCalledWith('pick_files', undefined)
    await files.pickDirectory()
    expect(invokeMock).toHaveBeenLastCalledWith('pick_directory', undefined)
    await files.pickExportTarget()
    expect(invokeMock).toHaveBeenLastCalledWith('pick_export_target', undefined)

    const openRequest = { paths: ['/tmp/a.md'], entry: 'dialog' as const }
    await files.openDocuments(openRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('open_documents', { req: openRequest })

    const readRequest = { docId: 'd-1', purpose: 'initial' as const }
    await files.readDocument(readRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('read_document', { req: readRequest })

    const relink = { docId: 'd-1', newPath: '/tmp/b.md' }
    await files.relinkDocument(relink)
    expect(invokeMock).toHaveBeenLastCalledWith('relink_document', { req: relink })

    await files.getSourceInfo('d-1')
    expect(invokeMock).toHaveBeenLastCalledWith('get_source_info', { docId: 'd-1' })

    const windowRequest = { docId: 'd-1', startLine: 1, maxLines: 200 }
    await files.readSourceWindow(windowRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('read_source_window', { req: windowRequest })
  })

  it('tree and search commands', async () => {
    const openDirectory = { path: '/tmp/docs', persist: false }
    await tree.openDirectory(openDirectory)
    expect(invokeMock).toHaveBeenLastCalledWith('open_directory', { req: openDirectory })

    const readDirectory = { rootId: 'r-1', dirPath: '/tmp/docs' }
    await tree.readDirectory(readDirectory)
    expect(invokeMock).toHaveBeenLastCalledWith('read_directory', { req: readDirectory })

    const searchRequest = { docId: 'd-1', query: 'x', caseSensitive: false, maxResults: 100 }
    await search.searchSource(searchRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('search_source', { req: searchRequest })
  })

  it('watch commands (11–12)', async () => {
    const watchRequest = { docId: 'd-1', resourcePaths: ['/tmp/img.png'] }
    await watch.watchDocument(watchRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('watch_document', { req: watchRequest })

    await watch.unwatchDocument('d-1')
    expect(invokeMock).toHaveBeenLastCalledWith('unwatch_document', { docId: 'd-1' })
  })

  it('storage commands (13–21)', async () => {
    await storage.listRecents()
    expect(invokeMock).toHaveBeenLastCalledWith('list_recents', undefined)

    await storage.touchRecent('d-1')
    expect(invokeMock).toHaveBeenLastCalledWith('touch_recent', { docId: 'd-1' })

    const position = {
      docId: 'd-1',
      anchor: {
        versionHash: 'h',
        headingPath: [],
        blockFingerprint: 'fp1:x',
        offsetRatio: 0,
        sourceRange: { startByte: 0, endByte: 0 },
      },
    }
    await storage.savePosition(position)
    expect(invokeMock).toHaveBeenLastCalledWith('save_position', { req: position })

    await storage.loadPosition('d-1')
    expect(invokeMock).toHaveBeenLastCalledWith('load_position', { docId: 'd-1' })

    const session = { tabs: [{ tabId: 't1', docId: 'd-1', orderIndex: 0, isActive: true }] }
    await storage.saveSession(session)
    expect(invokeMock).toHaveBeenLastCalledWith('save_session', { req: session })

    await storage.loadSession()
    expect(invokeMock).toHaveBeenLastCalledWith('load_session', undefined)

    await storage.getStorageOverview()
    expect(invokeMock).toHaveBeenLastCalledWith('get_storage_overview', undefined)

    const clear = { categories: ['recents' as const], confirm: true }
    await storage.clearRecords(clear)
    expect(invokeMock).toHaveBeenLastCalledWith('clear_records', { req: clear })

    await storage.resumeRecording()
    expect(invokeMock).toHaveBeenLastCalledWith('resume_recording', undefined)
    await storage.resumeRecording({ categories: ['positions'] })
    expect(invokeMock).toHaveBeenLastCalledWith('resume_recording', {
      req: { categories: ['positions'] },
    })
  })

  it('settings commands (22–23)', async () => {
    await settings.getSettings()
    expect(invokeMock).toHaveBeenLastCalledWith('get_settings', undefined)

    await settings.updateSettings({ theme: 'dark' })
    expect(invokeMock).toHaveBeenLastCalledWith('update_settings', { req: { patch: { theme: 'dark' } } })
  })

  it('authorization commands (24–27)', async () => {
    const check = { docId: 'd-1', rawSrc: './img.png' }
    await auth.checkResourceAccess(check)
    expect(invokeMock).toHaveBeenLastCalledWith('check_resource_access', { req: check })

    const grant = { docId: 'd-1', rootPath: '/tmp', persist: false }
    await auth.grantLocalRoot(grant)
    expect(invokeMock).toHaveBeenLastCalledWith('grant_local_root', { req: grant })

    await auth.listGrants()
    expect(invokeMock).toHaveBeenLastCalledWith('list_grants', undefined)

    await auth.revokeGrant('g-1')
    expect(invokeMock).toHaveBeenLastCalledWith('revoke_grant', { grantId: 'g-1' })
  })

  it('remote image commands (28–30)', async () => {
    const grant = { docId: 'd-1', origins: ['https://example.com'] }
    await remote.grantRemoteSession(grant)
    expect(invokeMock).toHaveBeenLastCalledWith('grant_remote_session', { req: grant })

    await remote.revokeRemoteSession('d-1')
    expect(invokeMock).toHaveBeenLastCalledWith('revoke_remote_session', { docId: 'd-1' })

    const fetchRequest = { docId: 'd-1', url: 'https://example.com/a.png' }
    await remote.fetchRemoteImage(fetchRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('fetch_remote_image', { req: fetchRequest })
  })

  it('opener commands (31–32)', async () => {
    await opener.openExternalUrl('https://example.com')
    expect(invokeMock).toHaveBeenLastCalledWith('open_external_url', { url: 'https://example.com' })

    await opener.revealInFolder('/tmp/a.md')
    expect(invokeMock).toHaveBeenLastCalledWith('reveal_in_folder', { path: '/tmp/a.md' })
  })

  it('diagnostics commands (36–37)', async () => {
    const preview = { includeSourceContext: false, includeFullPaths: false }
    await diagnostics.previewDiagnostics(preview)
    expect(invokeMock).toHaveBeenLastCalledWith('preview_diagnostics', { req: preview })

    const exportRequest = { exportId: 'e-1', targetPath: '/tmp/out.txt', overwrite: false }
    await diagnostics.exportDiagnostics(exportRequest)
    expect(invokeMock).toHaveBeenLastCalledWith('export_diagnostics', { req: exportRequest })
  })

  it('app commands (33–35)', async () => {
    await app.getAppInfo()
    expect(invokeMock).toHaveBeenLastCalledWith('get_app_info', undefined)

    await app.readLegalText('license')
    expect(invokeMock).toHaveBeenLastCalledWith('read_legal_text', { req: { kind: 'license' } })

    await app.takePendingOpenRequests()
    expect(invokeMock).toHaveBeenLastCalledWith('take_pending_open_requests', undefined)
  })

  it('clipboard wrapper uses the plugin command and only reports confirmed success', async () => {
    invokeMock.mockResolvedValueOnce(undefined)
    await expect(clipboard.copyText('hello')).resolves.toEqual({ ok: true })
    expect(invokeMock).toHaveBeenLastCalledWith('plugin:clipboard-manager|write_text', {
      text: 'hello',
    })

    invokeMock.mockRejectedValueOnce(internalError)
    await expect(clipboard.copyText('hello')).resolves.toEqual({
      ok: false,
      error: internalError,
    })

    invokeMock.mockRejectedValueOnce('unexpected')
    const failure = await clipboard.copyText('hello')
    expect(failure).toEqual({ ok: false, error: expect.objectContaining({ code: 'PS_INTERNAL' }) })
  })

  it('propagates normalized PaperStackError from wrappers', async () => {
    invokeMock.mockRejectedValueOnce(internalError)
    await expect(files.getSourceInfo('d-1')).rejects.toMatchObject({
      name: 'PaperStackError',
      code: 'PS_INTERNAL',
    })
  })
})
