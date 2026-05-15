import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import hljs from 'highlight.js/lib/common'
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
  List,
  GripHorizontal,
  Maximize2,
  Minimize2
} from 'lucide-react'
import {
  fetchMassCodeData,
  writeMassCodeSnippet,
  type MassCodeData,
  type MassCodeExtendedSnippet,
  type MassCodeType
} from '@/lib/masscode-manager'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  clampFloatingMassCodeBounds,
  getDefaultFloatingMassCodeBounds,
  getMaximizedFloatingMassCodeBounds,
  type FloatingMassCodePanelBounds
} from './floating-masscode-panel-bounds'

type NavCategory = 'all' | 'inbox' | 'favorites' | 'trash' | 'folder'
const FLOATING_MASSCODE_NO_DRAG_SELECTOR =
  'button,input,textarea,select,a,[role="menuitem"],[data-floating-masscode-no-drag]'

function isFloatingMassCodeDragTarget(target: EventTarget): boolean {
  return !(target instanceof HTMLElement && target.closest(FLOATING_MASSCODE_NO_DRAG_SELECTOR))
}

export function FloatingMassCodePanel({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}): React.JSX.Element | null {
  const vaultPath = useAppStore((s) => s.settings?.experimentalMassCodeVaultPath)
  const previewLines = useAppStore((s) => s.settings?.experimentalMassCodePreviewLines ?? 1)
  const theme = useAppStore((s) => s.settings?.theme ?? 'system')
  const [data, setData] = useState<MassCodeData | null>(null)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<MassCodeType>(1)
  const [selectedNav, setSelectedNav] = useState<NavCategory>('all')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [bounds, setBounds] = useState<FloatingMassCodePanelBounds>(() =>
    getDefaultFloatingMassCodeBounds()
  )
  const [maximized, setMaximized] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Partial<MassCodeExtendedSnippet> | null>(
    null
  )
  const [viewingSnippet, setViewingSnippet] = useState<MassCodeExtendedSnippet | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const codeRef = useRef<HTMLElement>(null)
  const restoreBoundsRef = useRef<FloatingMassCodePanelBounds | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    left: number
    top: number
  } | null>(null)

  const refreshData = useCallback(() => {
    if (vaultPath) {
      void fetchMassCodeData(vaultPath).then(setData).catch(console.error)
    }
  }, [vaultPath])

  useEffect(() => {
    if (open) {
      refreshData()
      if (!maximized) {
        setBounds(getDefaultFloatingMassCodeBounds())
      }
    }
  }, [maximized, open, refreshData])

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return
    }
    const handleResize = () => {
      if (maximized) {
        setBounds(getMaximizedFloatingMassCodeBounds())
        return
      }
      setBounds((prev) => clampFloatingMassCodeBounds(prev))
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [maximized, open])

  useEffect(() => {
    if (!viewingSnippet || !codeRef.current) {
      return
    }
    const language = viewingSnippet.language?.trim().toLowerCase() ?? ''
    codeRef.current.className = language ? `language-${language}` : ''
    hljs.highlightElement(codeRef.current)
  }, [viewingSnippet])

  const filteredSnippets = useMemo(() => {
    if (!data) {
      return []
    }
    return data.snippets.filter((s) => {
      const mSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
      if (!mSearch || s.type !== selectedType) {
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
    return data.folders.filter((f) =>
      f.id.replaceAll('\\', '/').toLowerCase().includes(pathPart)
    )
  }, [data, selectedType])

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

  const handleDragStart = (e: React.PointerEvent) => {
    if (maximized) {
      return
    }
    if (e.button !== 0 || !isFloatingMassCodeDragTarget(e.target)) {
      return
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left: bounds.left,
      top: bounds.top
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) {
      return
    }
    setBounds((prev) =>
      clampFloatingMassCodeBounds({
        ...prev,
        left: drag.left + e.clientX - drag.startX,
        top: drag.top + e.clientY - drag.startY
      })
    )
  }

  const handleDragEnd = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
  }

  const toggleMaximized = useCallback(() => {
    setMaximized((current) => {
      if (current) {
        setBounds(restoreBoundsRef.current ?? getDefaultFloatingMassCodeBounds())
        restoreBoundsRef.current = null
        return false
      }
      restoreBoundsRef.current = bounds
      setBounds(getMaximizedFloatingMassCodeBounds())
      return true
    })
  }, [bounds])

  const resolvedThemeClass =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'markdown-dark'
        : 'markdown-light'
      : theme === 'dark'
        ? 'markdown-dark'
        : 'markdown-light'
  if (!open) {
    return null
  }

  const renderHeader = (
    title: string,
    onBack: () => void,
    actionIcon?: React.ReactNode,
    onAction?: () => void
  ) => (
      <div
        className="flex items-center justify-between p-2 border-b border-border bg-secondary/30 shrink-0 cursor-grab active:cursor-grabbing"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onDoubleClick={(e) => {
          if (e.button !== 0 || !isFloatingMassCodeDragTarget(e.target)) {
            return
          }
          e.preventDefault()
          toggleMaximized()
        }}
      >
        <div className="flex items-center gap-2" data-floating-masscode-no-drag>
        <Button variant="ghost" size="icon-xs" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <span className="text-xs font-medium truncate max-w-[400px]">{title}</span>
      </div>
      <div className="flex items-center gap-1" data-floating-masscode-no-drag>
        <GripHorizontal className="size-3.5 text-muted-foreground/30 mr-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleMaximized}
          aria-label={maximized ? 'Restore panel size' : 'Maximize panel'}
        >
          {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
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
    return (
      <div
        className="fixed z-50 flex flex-col bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in duration-200 w-[750px] h-[500px]"
        style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
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
        <div className={cn('flex-1 p-0 overflow-hidden flex flex-col', resolvedThemeClass)}>
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
          <div className="flex-1 min-h-0 overflow-auto px-3 py-2">
            <pre className="min-w-max text-[10px] leading-4 font-mono whitespace-pre text-foreground">
              <code ref={codeRef}>{viewingSnippet.content}</code>
            </pre>
          </div>
        </div>
      </div>
    )
  }

  if (editingSnippet) {
    return (
      <div
        className="fixed z-50 flex flex-col bg-background border border-border shadow-2xl rounded-lg overflow-hidden w-[750px] h-[500px]"
        style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      >
        {renderHeader(
          editingSnippet.id ? 'Edit Snippet' : 'New Snippet',
          () => setEditingSnippet(null),
          <Save className="size-3.5" />,
          () => void handleSave()
        )}
        <div className="flex-1 p-4 space-y-4 overflow-auto flex flex-col">
          <div className="space-y-1.5 shrink-0">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Title
            </label>
            <Input
              value={editingSnippet.name || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5 shrink-0">
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
          <div className="space-y-1.5 flex flex-col flex-1 min-h-0">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Content
            </label>
            <textarea
              value={editingSnippet.content || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
              className="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed z-50 flex flex-col bg-background border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in duration-300 w-[750px] h-[500px]"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      data-floating-masscode-panel
    >
      <div
        className="flex items-center justify-between p-2 border-b border-border bg-secondary/30 shrink-0 cursor-grab active:cursor-grabbing"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-2 px-2 flex-1" data-floating-masscode-no-drag>
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets..."
            className="h-7 border-none bg-transparent focus-visible:ring-0 text-sm p-0 shadow-none"
          />
        </div>
        <div className="flex items-center gap-1" data-floating-masscode-no-drag>
          <GripHorizontal className="size-3.5 text-muted-foreground/30 mr-1" />
          <Button variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)}>
            <X className="size-3.5" />
          </Button>
        </div>
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
                      <span className="text-xs font-medium truncate">{s.name}</span>
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
