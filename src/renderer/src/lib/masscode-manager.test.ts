import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMassCodeData } from './masscode-manager'

type DirEntry = { name: string; isDirectory: boolean }

const directoryEntries = new Map<string, DirEntry[]>()
const fileContents = new Map<string, string>()

function setDir(path: string, entries: DirEntry[]): void {
  directoryEntries.set(path, entries)
}

function setFile(path: string, content: string): void {
  fileContents.set(path, content)
}

function installFsMocks(): void {
  vi.stubGlobal('window', {
    api: {
      fs: {
        readDir: vi.fn(async ({ dirPath }: { dirPath: string }) => directoryEntries.get(dirPath) ?? []),
        readFile: vi.fn(async ({ filePath }: { filePath: string }) => ({
          content: fileContents.get(filePath) ?? ''
        }))
      }
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  directoryEntries.clear()
  fileContents.clear()
})

describe('masscode manager', () => {
  it('keeps folder assignments from notes trees and reads favorite booleans from string frontmatter', async () => {
    setDir('/vault', [{ name: 'notes', isDirectory: true }])
    setDir('/vault/notes', [{ name: 'BibleScroll', isDirectory: true }])
    setDir('/vault/notes/BibleScroll', [{ name: 'u-version-app-key.md', isDirectory: false }])
    setFile(
      '/vault/notes/BibleScroll/u-version-app-key.md',
      ['---', 'name: U version app key', 'isFavorite: true', '---', 'snippet body'].join('\n')
    )
    installFsMocks()

    const data = await fetchMassCodeData('/vault')
    const snippet = data.snippets[0]

    expect(data.folders.map((folder) => folder.name)).toEqual(['BibleScroll'])
    expect(snippet.folderId).toBe('/vault/notes/BibleScroll')
    expect(snippet.isFavorite).toBe(true)
    expect(snippet.type).toBe(2)
  })

  it('treats numeric-string favorites as true for code snippets', async () => {
    setDir('/vault', [{ name: 'code', isDirectory: true }])
    setDir('/vault/code', [{ name: 'skills', isDirectory: true }])
    setDir('/vault/code/skills', [{ name: 'xc-docs.md', isDirectory: false }])
    setFile(
      '/vault/code/skills/xc-docs.md',
      ['---', 'name: xc docs.md', 'isFavorites: 1', '---', '<p>html</p>'].join('\n')
    )
    installFsMocks()

    const data = await fetchMassCodeData('/vault')

    expect(data.snippets).toHaveLength(1)
    expect(data.snippets[0].isFavorite).toBe(true)
    expect(data.snippets[0].type).toBe(1)
  })

  it('keeps filesystem folder placement even when frontmatter folderId is null', async () => {
    setDir('/vault', [{ name: 'notes', isDirectory: true }])
    setDir('/vault/notes', [{ name: 'United folder one', isDirectory: true }])
    setDir('/vault/notes/United folder one', [{ name: 'untitled-no1.md', isDirectory: false }])
    setFile(
      '/vault/notes/United folder one/untitled-no1.md',
      ['---', 'name: Untitled no1', 'folderId: null', '---', 'body'].join('\n')
    )
    installFsMocks()

    const data = await fetchMassCodeData('/vault')

    expect(data.snippets).toHaveLength(1)
    expect(data.snippets[0].folderId).toBe('/vault/notes/United folder one')
  })
})
