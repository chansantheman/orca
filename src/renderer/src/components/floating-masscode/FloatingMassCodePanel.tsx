import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  X,
  Edit2,
  Plus,
  Folder,
  ArrowLeft,
  Save,
  ChevronRight,
  Inbox,
  Star,
  Library,
  Trash2,
  Tag,
  Copy,
  Check
} from 'lucide-react'
import {
  fetchMassCodeData,
  writeMassCodeSnippet,
  type MassCodeData,
  type MassCodeExtendedSnippet
} from '@/lib/masscode-manager'
import { toast } from 'sonner'

type SidebarCategory = 'library' | 'inbox' | 'favorites' | 'trash' | 'tags' | 'folders'

export function FloatingMassCodePanel({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element | null {
  const vaultPath = useAppStore((s) => s.settings?.experimentalMassCodeVaultPath)
  const previewLines = useAppStore((s) => s.settings?.experimentalMassCodePreviewLines ?? 1)
  const [data, setData] = useState<MassCodeData | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SidebarCategory>('library')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [editingSnippet, setEditingSnippet] = useState<Partial<MassCodeExtendedSnippet> | null>(
    null
  )
  const [viewingSnippet, setViewingSnippet] = useState<MassCodeExtendedSnippet | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refreshData = useCallback(() => {
    if (vaultPath) {
      void fetchMassCodeData(vaultPath)
        .then(setData)
        .catch((err) => {
          toast.error('Failed to load massCode snippets')
          console.error(err)
        })
    }
  }, [vaultPath])

  useEffect(() => {
    if (open) {
      refreshData()
    }
  }, [open, refreshData])

  const filteredSnippets = useMemo(() => {
    if (!data) {
      return []
    }
    return data.snippets.filter((s) => {
      // Basic search
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
      if (!matchesSearch) {
        return false
      }

      // Category filters
      if (selectedCategory === 'inbox') {
        return s.folderId === null || s.id.includes('/Inbox/')
      }
      if (selectedCategory === 'favorites') {
        return s.isFavorite && !s.isTrash
      }
      if (selectedCategory === 'trash') {
        return s.isTrash
      }
      if (selectedCategory === 'tags' && selectedTag) {
        return s.tags.includes(selectedTag) && !s.isTrash
      }
      if (selectedCategory === 'folders' && selectedFolderId) {
        return s.folderId === selectedFolderId && !s.isTrash
      }

      // Default: Library (all non-trash)
      return !s.isTrash
    })
  }, [data, search, selectedCategory, selectedFolderId, selectedTag])

  if (!open) {
    return null
  }

  const handleCopy = (snippet: MassCodeExtendedSnippet) => {
    void navigator.clipboard.writeText(snippet.content)
    setCopiedId(snippet.id)
    toast.success(`Copied "${snippet.name}"`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSave = async () => {
    if (!editingSnippet || !vaultPath) {
      return
    }
    try {
      const filePath =
        editingSnippet.id ||
        `${selectedFolderId || vaultPath}/${editingSnippet.name || 'Untitled'}.md`
      await writeMassCodeSnippet(filePath, editingSnippet)
      toast.success('Snippet saved')
      setEditingSnippet(null)
      refreshData()
    } catch (err) {
      toast.error('Failed to save snippet')
      console.error(err)
    }
  }

  // --- Views ---

  if (viewingSnippet) {
    return (
      <div
        className="fixed bottom-20 right-3 z-50 flex flex-col w-[600px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        data-floating-masscode-panel
      >
        <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-xs" onClick={() => setViewingSnippet(null)}>
              <ArrowLeft className="size-3.5" />
            </Button>
            <span className="text-xs font-medium truncate max-w-[400px]">
              {viewingSnippet.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={() => handleCopy(viewingSnippet)}>
              {copiedId === viewingSnippet.id ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setEditingSnippet(viewingSnippet)
                setViewingSnippet(null)
              }}
            >
              <Edit2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/10">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {viewingSnippet.language}
            </span>
            {viewingSnippet.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-accent-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed select-text">
              {viewingSnippet.content}
            </pre>
          </ScrollArea>
        </div>
      </div>
    )
  }

  if (editingSnippet) {
    return (
      <div
        className="fixed bottom-20 right-3 z-50 flex flex-col w-[600px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        data-floating-masscode-panel
      >
        <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30">
          <Button variant="ghost" size="icon-xs" onClick={() => setEditingSnippet(null)}>
            <ArrowLeft className="size-3.5" />
          </Button>
          <span className="text-xs font-medium">
            {editingSnippet.id ? 'Edit Snippet' : 'New Snippet'}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleSave}>
            <Save className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-auto">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Title
            </label>
            <Input
              value={editingSnippet.name || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, name: e.target.value })}
              placeholder="Snippet title"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Language
            </label>
            <select
              value={editingSnippet.language || 'markdown'}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, language: e.target.value })}
              className="w-full h-8 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="markdown">Markdown</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="swift">Swift</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
            </select>
          </div>
          <div className="space-y-1.5 flex flex-col flex-1">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Content
            </label>
            <textarea
              value={editingSnippet.content || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
              className="flex-1 min-h-[250px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Paste code here..."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-20 right-3 z-50 flex flex-col w-[600px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
      data-floating-masscode-panel
    >
      <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2 px-2 flex-1">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets..."
            className="h-7 border-none bg-transparent focus-visible:ring-0 text-sm p-0 shadow-none"
          />
        </div>
        <Button variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-40 border-r border-border bg-secondary/10 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-4">
              {/* Main Categories */}
              <div className="space-y-1">
                <SidebarItem
                  active={selectedCategory === 'library'}
                  onClick={() => {
                    setSelectedCategory('library')
                    setSelectedFolderId(null)
                    setSelectedTag(null)
                  }}
                  icon={<Library className="size-3.5" />}
                  label="Library"
                />
                <SidebarItem
                  active={selectedCategory === 'inbox'}
                  onClick={() => {
                    setSelectedCategory('inbox')
                    setSelectedFolderId(null)
                    setSelectedTag(null)
                  }}
                  icon={<Inbox className="size-3.5" />}
                  label="Inbox"
                />
                <SidebarItem
                  active={selectedCategory === 'favorites'}
                  onClick={() => {
                    setSelectedCategory('favorites')
                    setSelectedFolderId(null)
                    setSelectedTag(null)
                  }}
                  icon={<Star className="size-3.5" />}
                  label="Favorites"
                />
                <SidebarItem
                  active={selectedCategory === 'trash'}
                  onClick={() => {
                    setSelectedCategory('trash')
                    setSelectedFolderId(null)
                    setSelectedTag(null)
                  }}
                  icon={<Trash2 className="size-3.5" />}
                  label="Trash"
                />
              </div>

              {/* Folders */}
              {data?.folders.length ? (
                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Folders
                  </span>
                  {data.folders.map((folder) => (
                    <SidebarItem
                      key={folder.id}
                      active={selectedCategory === 'folders' && selectedFolderId === folder.id}
                      onClick={() => {
                        setSelectedCategory('folders')
                        setSelectedFolderId(folder.id)
                        setSelectedTag(null)
                      }}
                      icon={<Folder className="size-3.5" />}
                      label={folder.name}
                    />
                  ))}
                </div>
              ) : null}

              {/* Tags */}
              {data?.tags.length ? (
                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tags
                  </span>
                  {data.tags.map((tag) => (
                    <SidebarItem
                      key={tag}
                      active={selectedCategory === 'tags' && selectedTag === tag}
                      onClick={() => {
                        setSelectedCategory('tags')
                        setSelectedTag(tag)
                        setSelectedFolderId(null)
                      }}
                      icon={<Tag className="size-3.5" />}
                      label={tag}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredSnippets.map((snippet) => (
                <div
                  key={snippet.id}
                  onClick={() => handleCopy(snippet)}
                  className="group flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{snippet.name}</span>
                    {previewLines > 0 && (
                      <span
                        className={`text-[10px] text-muted-foreground font-mono leading-tight mt-0.5 line-clamp-${previewLines}`}
                      >
                        {snippet.content}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingSnippet(snippet)
                      }}
                    >
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredSnippets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <span className="text-xs">No snippets found</span>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-2 border-t border-border bg-secondary/20 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground px-2">
              {filteredSnippets.length} snippets
            </span>
            <Button
              variant="outline"
              size="xs"
              className="h-7 gap-1.5 text-xs px-2"
              onClick={() =>
                setEditingSnippet({ name: '', content: '', language: 'markdown', tags: [] })
              }
            >
              <Plus className="size-3" />
              New Snippet
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors truncate ${active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}
