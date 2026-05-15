import type { MassCodeSnippet, MassCodeFolder } from '../../../shared/types'

/**
 * massCode v5+ Markdown Vault structure:
 * - Each folder in the app is a physical folder on disk.
 * - Each snippet is a .md file with YAML frontmatter.
 */

export type MassCodeData = {
  snippets: MassCodeSnippet[]
  folders: MassCodeFolder[]
}

export async function fetchMassCodeData(vaultPath: string): Promise<MassCodeData> {
  const folders: MassCodeFolder[] = []
  const snippets: MassCodeSnippet[] = []

  // Helper to recursively walk the vault
  async function walk(currentPath: string, parentId: string | null = null): Promise<void> {
    const entries = await window.api.fs.readDir({ dirPath: currentPath })

    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`
      if (entry.isDirectory) {
        const folderId = fullPath // Use full path as ID for simplicity
        folders.push({
          id: folderId,
          name: entry.name,
          parentId
        })
        await walk(fullPath, folderId)
      } else if (entry.name.endsWith('.md')) {
        try {
          const { content } = await window.api.fs.readFile({ filePath: fullPath })
          const snippet = parseSnippet(content, fullPath, parentId)
          if (snippet) {
            snippets.push(snippet)
          }
        } catch (err) {
          console.error(`Failed to parse snippet at ${fullPath}:`, err)
        }
      }
    }
  }

  await walk(vaultPath)
  return { snippets, folders }
}

function parseSnippet(
  rawContent: string,
  filePath: string,
  folderId: string | null
): MassCodeSnippet | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
  const match = rawContent.match(frontmatterRegex)

  if (!match) {
    // Fallback: title from filename, content is the whole file
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

  // Extremely simple YAML-ish parser for massCode frontmatter
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
    updatedAt: Number(metadata.updatedAt) || Date.now()
  }
}

export async function writeMassCodeSnippet(
  filePath: string,
  snippet: Partial<MassCodeSnippet>
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
