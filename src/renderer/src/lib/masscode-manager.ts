import type { MassCodeSnippet, MassCodeFolder } from '../../../shared/types'

/**
 * massCode v5+ Markdown Vault structure:
 * - Root folders define types: code, notes, http, math, tools.
 * - Each type folder contains user folders or .masscode/inbox.
 * - Each snippet is a .md file with YAML frontmatter.
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

export async function fetchMassCodeData(vaultPath: string): Promise<MassCodeData> {
  const folders: MassCodeFolder[] = []
  const snippets: MassCodeExtendedSnippet[] = []
  const tagsSet = new Set<string>()

  // Try to read .state.json for favorites/other state
  let stateFavorites: string[] = []
  try {
    const stateContent = await window.api.fs.readFile({ filePath: `${vaultPath}/.state.json` })
    const state = JSON.parse(stateContent.content)
    stateFavorites = state.favorites || []
  } catch {
    // ignore
  }

  // Helper to recursively walk the vault
  async function walk(
    currentPath: string,
    parentId: string | null = null,
    currentType: MassCodeType | null = null
  ): Promise<void> {
    const entries = await window.api.fs.readDir({ dirPath: currentPath })

    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`
      const relativePath = fullPath.replace(`${vaultPath}/`, '')
      const pathSegments = relativePath.split('/')

      // Determine type from root folder if not already set
      let detectedType = currentType
      if (!detectedType && pathSegments.length > 0) {
        detectedType = TYPE_MAP[pathSegments[0].toLowerCase()] || 1
      }

      if (entry.isDirectory) {
        // Skip .git or other system folders, but allow .masscode/inbox
        if (entry.name.startsWith('.') && entry.name !== '.masscode') {
          continue
        }

        // Don't add 'code', 'notes', etc. as user folders
        const isRootTypeFolder = currentPath === vaultPath && TYPE_MAP[entry.name.toLowerCase()]

        const folderId = fullPath
        if (!isRootTypeFolder && entry.name !== '.masscode' && entry.name !== 'inbox') {
          folders.push({
            id: folderId,
            name: entry.name,
            parentId: currentPath === vaultPath || isRootTypeFolder ? null : parentId
          })
        }

        await walk(fullPath, folderId, detectedType)
      } else if (entry.name.endsWith('.md')) {
        try {
          const { content } = await window.api.fs.readFile({ filePath: fullPath })
          const snippet = parseSnippet(content, fullPath, parentId)
          if (snippet) {
            const isTrash = fullPath.toLowerCase().includes('/trash/')
            const inInbox = fullPath.toLowerCase().includes('/inbox/')

            // @ts-ignore - use metadata favorites if present
            const isFavoriteInFile = snippet.isFavorites === 1 || snippet.isFavorite === true

            const extendedSnippet: MassCodeExtendedSnippet = {
              ...snippet,
              type: detectedType || 1,
              isFavorite:
                isFavoriteInFile ||
                stateFavorites.includes(snippet.id) ||
                stateFavorites.includes(entry.name.replace('.md', '')),
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
    ...metadata
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

  // Preserve original metadata if possible, but update key fields
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
