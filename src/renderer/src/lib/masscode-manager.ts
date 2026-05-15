import type { MassCodeSnippet, MassCodeFolder } from '../../../shared/types'

/**
 * massCode v5+ Markdown Vault structure:
 * - Root folders define types: code, notes, http.
 * - Each type folder contains user folders or .masscode/inbox.
 * - Snippets are .md files with YAML frontmatter.
 * - Type-specific state lives in [Type]/.masscode/state.json
 */

export type MassCodeType = 1 | 2 | 3 | 4 | 5

export type MassCodeExtendedSnippet = MassCodeSnippet & {
  isFavorite: boolean
  isTrash: boolean
  type: MassCodeType
  inInbox: boolean
}

export type MassCodeData = {
  snippets: MassCodeExtendedSnippet[]
  folders: MassCodeFolder[]
  tags: string[]
}

const TYPE_MAP: Record<string, MassCodeType> = {
  code: 1,
  notes: 2,
  http: 3,
  math: 4,
  tools: 5
}

function normalizePathForMatch(pathValue: string): string {
  return pathValue.replaceAll('\\', '/').toLowerCase()
}

function parseTruthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

function getMetadataValueCaseInsensitive(
  metadata: Record<string, unknown>,
  keys: string[]
): unknown {
  const lookup = new Map(Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value]))
  for (const key of keys) {
    const value = lookup.get(key.toLowerCase())
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

export async function fetchMassCodeData(vaultPath: string): Promise<MassCodeData> {
  const folders: MassCodeFolder[] = []
  const snippets: MassCodeExtendedSnippet[] = []
  const tagsSet = new Set<string>()
  const normalizedVaultPath = normalizePathForMatch(vaultPath)

  // Helper to recursively walk the vault
  async function walk(
    currentPath: string,
    parentId: string | null = null,
    currentType: MassCodeType | null = null
  ): Promise<void> {
    const entries = await window.api.fs.readDir({ dirPath: currentPath })

    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`
      const normalizedFullPath = normalizePathForMatch(fullPath)
      const relativePath = normalizedFullPath.replace(`${normalizedVaultPath}/`, '')
      const pathSegments = relativePath.split('/')

      // Determine type from root folder
      let detectedType = currentType
      if (!detectedType && pathSegments.length > 0) {
        detectedType = TYPE_MAP[pathSegments[0].toLowerCase()]
      }

      if (entry.isDirectory) {
        // Skip hidden folders except .masscode (where inbox snippets live)
        if (entry.name.startsWith('.') && entry.name !== '.masscode') {
          continue
        }

        const isRootTypeFolder = currentPath === vaultPath && TYPE_MAP[entry.name.toLowerCase()]
        const folderNameLower = entry.name.toLowerCase()
        const isSystemDir =
          folderNameLower === '.masscode' ||
          folderNameLower === 'inbox' ||
          folderNameLower === 'trash'

        const folderId = fullPath
        if (!isRootTypeFolder && !isSystemDir) {
          folders.push({
            id: folderId,
            name: entry.name,
            parentId: currentPath === vaultPath || isRootTypeFolder ? null : parentId
          })
        }

        await walk(fullPath, isSystemDir ? parentId : folderId, detectedType)
      } else if (entry.name.endsWith('.md')) {
        try {
          const { content } = await window.api.fs.readFile({ filePath: fullPath })
          const snippet = parseSnippet(content, fullPath, parentId)
          if (snippet) {
            const isTrash = normalizedFullPath.includes('/trash/')
            const inInbox = normalizedFullPath.includes('/inbox/')

            // Why: massCode vaults in the wild mix naming/casing and string booleans.
            const metadata = snippet as unknown as Record<string, unknown>
            const favoriteValue = getMetadataValueCaseInsensitive(metadata, [
              'isFavorites',
              'isFavorite',
              'favorited',
              'favorite'
            ])
            const isFavorite = parseTruthyFlag(favoriteValue)

            const extendedSnippet: MassCodeExtendedSnippet = {
              ...snippet,
              type: detectedType || 1,
              isFavorite,
              isTrash,
              inInbox
            }
            snippets.push(extendedSnippet)
            snippet.tags.forEach((t) => tagsSet.add(t))
          }
        } catch (err) {
          console.error(`Failed to parse snippet at ${fullPath}:`, err)
        }
      }
    }
  }

  await walk(vaultPath)
  return { snippets, folders, tags: Array.from(tagsSet).sort() }
}

function parseSnippet(
  rawContent: string,
  filePath: string,
  folderId: string | null
): MassCodeSnippet | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
  const match = rawContent.match(frontmatterRegex)

  if (!match) {
    const name = filePath.split('/').pop()?.replace('.md', '') || 'Untitled'
    return {
      id: filePath,
      name,
      content: rawContent,
      language: 'markdown',
      tags: [],
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }

  const yaml = match[1]
  const content = match[2]
  const metadata: Record<string, unknown> = {}

  yaml.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim()
      if (value.startsWith('[') && value.endsWith(']')) {
        metadata[key.trim()] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      } else {
        metadata[key.trim()] = value
      }
    }
  })

  // Why: folder assignment comes from the vault filesystem path; frontmatter
  // can be stale and must not re-parent snippets in the UI.
  const { folderId: _frontmatterFolderId, ...metadataWithoutFolderId } = metadata

  return {
    id: filePath,
    name: (metadata.name as string) || filePath.split('/').pop()?.replace('.md', '') || 'Untitled',
    content: content.trim(),
    language: (metadata.language as string) || 'markdown',
    tags: (metadata.tags as string[]) || [],
    folderId,
    createdAt: Number(metadata.createdAt) || Date.now(),
    updatedAt: Number(metadata.updatedAt) || Date.now(),
    // @ts-ignore - carry extra metadata for internal processing
    ...metadataWithoutFolderId
  }
}

export async function writeMassCodeSnippet(
  filePath: string,
  snippet: Partial<MassCodeExtendedSnippet>
): Promise<void> {
  const name = snippet.name || 'Untitled'
  const language = snippet.language || 'markdown'
  const tags = snippet.tags || []
  const createdAt = snippet.createdAt || Date.now()
  const updatedAt = Date.now()
  const content = snippet.content || ''

  const frontmatter = [
    '---',
    `name: ${name}`,
    `language: ${language}`,
    `tags: [${tags.join(', ')}]`,
    `createdAt: ${createdAt}`,
    `updatedAt: ${updatedAt}`,
    '---',
    content
  ].join('\n')

  await window.api.fs.writeFile({ filePath, content: frontmatter })
}
