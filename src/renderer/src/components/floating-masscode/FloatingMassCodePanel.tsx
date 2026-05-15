import { useEffect, useState, useMemo, useCallback } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  X,
  Plus,
  Folder,
  ArrowLeft,
  Save,
  ChevronRight,
  Inbox,
  Star,
  Trash2,
  Copy,
  Check,
  Code,
  FileText,
  Globe,
  Edit2,
  List
} from 'lucide-react'
import {
  fetchMassCodeData,
  writeMassCodeSnippet,
  type MassCodeData,
  type MassCodeExtendedSnippet,
  type MassCodeType
} from '@/lib/masscode-manager'
import { toast } from 'sonner'

type NavCategory = 'all' | 'inbox' | 'favorites' | 'trash' | 'folder'

export function FloatingMassCodePanel({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}): React.JSX.Element | null {
  const vaultPath = useAppStore((s) => s.settings?.experimentalMassCodeVaultPath)
  const previewLines = useAppStore((s) => s.settings?.experimentalMassCodePreviewLines ?? 1)
  const [data, setData] = useState<MassCodeData | null>(null)
  const [search, setSearch] = useState('')

  const [selectedType, setSelectedType] = useState<MassCodeType>(1)
  const [selectedNav, setSelectedNav] = useState<NavCategory>('all')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  const [editingSnippet, setEditingSnippet] = useState<Partial<MassCodeExtendedSnippet> | null>(
    null
  )
  const [viewingSnippet, setViewingSnippet] = useState<MassCodeExtendedSnippet | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refreshData = useCallback(() => {
    if (vaultPath) {
      void fetchMassCodeData(vaultPath).then(setData).catch(console.error)
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
      const mSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
      if (!mSearch) {
        return false
      }

      if (s.type !== selectedType) {
        return false
      }

      if (selectedNav === 'inbox') {
        return s.inInbox && !s.isTrash
      }
      if (selectedNav === 'favorites') {
        return s.isFavorite && !s.isTrash
      }
      if (selectedNav === 'trash') {
        return s.isTrash
      }
      if (selectedNav === 'folder' && selectedFolderId) {
        return s.folderId === selectedFolderId && !s.isTrash
      }

      return !s.isTrash
    })
  }, [data, search, selectedType, selectedNav, selectedFolderId])

  const visibleFolders = useMemo(() => {
    if (!data) {
      return []
    }
    const typePaths: Record<number, string> = { 1: '/code/', 2: '/notes/', 3: '/http/' }
    const pathPart = typePaths[selectedType]
    if (!pathPart) {
      return []
    }
    return data.folders.filter((f) => f.id.toLowerCase().includes(pathPart))
  }, [data, selectedType])

  if (!open) {
    return null
  }

  const handleCopy = (s: MassCodeExtendedSnippet) => {
    void navigator.clipboard.writeText(s.content)
    setCopiedId(s.id)
    toast.success(`Copied "${s.name}"`)
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

  const renderHeader = (
    title: string,
    onBack: () => void,
    actionIcon?: React.ReactNode,
    onAction?: () => void
  ) => (
    <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30 shrink-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-xs" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <span className="text-xs font-medium truncate max-w-[400px]">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {actionIcon && (
          <Button variant="ghost" size="icon-xs" onClick={onAction}>
            {actionIcon}
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )

  if (viewingSnippet) {
    const highlightContent = `\`\`\`${viewingSnippet.language || ''}\n${viewingSnippet.content}\n\`\`\``

    return (
      <div
        className="fixed bottom-20 right-3 z-50 flex flex-col w-[750px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in duration-200"
        data-floating-masscode-panel
      >
        {renderHeader(
          viewingSnippet.name,
          () => setViewingSnippet(null),
          <div className="flex gap-1">
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
          </div>
        )}
        <div className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/10 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {viewingSnippet.language}
            </span>
            {viewingSnippet.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-accent-foreground"
              >
                {t}
              </span>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 prose prose-invert prose-xs max-w-none">
              <Markdown rehypePlugins={[rehypeHighlight]}>{highlightContent}</Markdown>
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  if (editingSnippet) {
    return (
      <div
        className="fixed bottom-20 right-3 z-50 flex flex-col w-[750px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden"
        data-floating-masscode-panel
      >
        {renderHeader(
          editingSnippet.id ? 'Edit Snippet' : 'New Snippet',
          () => setEditingSnippet(null),
          <Save className="size-3.5" />,
          () => void handleSave()
        )}
        <div className="flex-1 p-4 space-y-4 overflow-auto">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Title
            </label>
            <Input
              value={editingSnippet.name || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, name: e.target.value })}
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
            </select>
          </div>
          <div className="space-y-1.5 flex flex-col flex-1">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Content
            </label>
            <textarea
              value={editingSnippet.content || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
              className="flex-1 min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-20 right-3 z-50 flex flex-col w-[750px] h-[500px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in duration-300"
      data-floating-masscode-panel
    >
      <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30 shrink-0">
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
        <div className="w-12 border-r border-border bg-secondary/20 flex flex-col items-center py-4 gap-4 shrink-0">
          <TypeIcon
            active={selectedType === 1}
            onClick={() => {
              setSelectedType(1)
              setSelectedNav('all')
            }}
            icon={<Code className="size-5" />}
            label="Code"
          />
          <TypeIcon
            active={selectedType === 2}
            onClick={() => {
              setSelectedType(2)
              setSelectedNav('all')
            }}
            icon={<FileText className="size-5" />}
            label="Notes"
          />
          <TypeIcon
            active={selectedType === 3}
            onClick={() => {
              setSelectedType(3)
              setSelectedNav('all')
            }}
            icon={<Globe className="size-5" />}
            label="HTTP"
          />
        </div>

        <div className="w-44 border-r border-border bg-secondary/5 flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-4">
              <div className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Library
                </span>
                <NavItem
                  active={selectedNav === 'inbox'}
                  onClick={() => {
                    setSelectedNav('inbox')
                    setSelectedFolderId(null)
                  }}
                  icon={<Inbox className="size-3.5" />}
                  label="Inbox"
                />
                <NavItem
                  active={selectedNav === 'favorites'}
                  onClick={() => {
                    setSelectedNav('favorites')
                    setSelectedFolderId(null)
                  }}
                  icon={<Star className="size-3.5" />}
                  label="Favorites"
                />
                <NavItem
                  active={selectedNav === 'all'}
                  onClick={() => {
                    setSelectedNav('all')
                    setSelectedFolderId(null)
                  }}
                  icon={<List className="size-3.5" />}
                  label="All Snippets"
                />
                <NavItem
                  active={selectedNav === 'trash'}
                  onClick={() => {
                    setSelectedNav('trash')
                    setSelectedFolderId(null)
                  }}
                  icon={<Trash2 className="size-3.5" />}
                  label="Trash"
                />
              </div>
              {visibleFolders.length ? (
                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Folders
                  </span>
                  {visibleFolders.map((f) => (
                    <NavItem
                      key={f.id}
                      active={selectedNav === 'folder' && selectedFolderId === f.id}
                      onClick={() => {
                        setSelectedNav('folder')
                        setSelectedFolderId(f.id)
                      }}
                      icon={<Folder className="size-3.5" />}
                      label={f.name}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredSnippets.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleCopy(s)}
                  className="group flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.name}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-mono px-1 bg-secondary/50 rounded shrink-0">
                        {s.language}
                      </span>
                    </div>
                    {previewLines > 0 && (
                      <div className="text-[10px] text-muted-foreground font-mono leading-tight mt-1 line-clamp-2 max-h-[2.4em] overflow-hidden">
                        {s.content
                          .split('\n')
                          .filter((l) => l.trim())
                          .slice(0, previewLines)
                          .join('\n')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingSnippet(s)
                      }}
                    >
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredSnippets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <span className="text-xs font-medium">No snippets found</span>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-2 border-t border-border bg-secondary/20 flex justify-between items-center shrink-0">
            <span className="text-[10px] text-muted-foreground px-2">
              {filteredSnippets.length} snippets
            </span>
            <Button
              variant="outline"
              size="xs"
              className="h-7 gap-1.5 text-xs px-2"
              onClick={() =>
                setEditingSnippet({
                  name: '',
                  content: '',
                  language: 'markdown',
                  tags: [],
                  type: selectedType
                })
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

function TypeIcon({
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
      title={label}
      className={`p-2 rounded-md transition-all ${active ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/50'}`}
    >
      {icon}
    </button>
  )
}

function NavItem({
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
