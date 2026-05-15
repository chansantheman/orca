import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X, Edit2, Plus, Folder, ArrowLeft, Save } from 'lucide-react'
import {
  fetchMassCodeData,
  writeMassCodeSnippet,
  type MassCodeData,
  type MassCodeSnippet
} from '@/lib/masscode-manager'
import { toast } from 'sonner'

export function FloatingMassCodePanel({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element | null {
  const vaultPath = useAppStore((s) => s.settings?.experimentalMassCodeVaultPath)
  const [data, setData] = useState<MassCodeData | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingSnippet, setEditingSnippet] = useState<Partial<MassCodeSnippet> | null>(null)

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
  }, [open, vaultPath, refreshData])

  const filteredSnippets = useMemo(() => {
    if (!data) {
      return []
    }
    return data.snippets.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
      const matchesFolder = selectedFolderId ? s.folderId === selectedFolderId : true
      return matchesSearch && matchesFolder
    })
  }, [data, search, selectedFolderId])

  if (!open) {
    return null
  }

  const handleCopy = (snippet: MassCodeSnippet) => {
    void navigator.clipboard.writeText(snippet.content)
    toast.success(`Copied "${snippet.name}" to clipboard`)
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

  if (editingSnippet) {
    return (
      <div
        className="fixed bottom-20 right-3 z-50 flex flex-col w-[600px] h-[400px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden"
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
            <Input
              value={editingSnippet.language || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, language: e.target.value })}
              placeholder="e.g. javascript"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5 flex flex-col flex-1">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">
              Content
            </label>
            <textarea
              value={editingSnippet.content || ''}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
              className="flex-1 min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Paste code here..."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-20 right-3 z-50 flex flex-col w-[600px] h-[400px] bg-background border border-border shadow-2xl rounded-lg overflow-hidden"
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
        <div className="w-48 border-r border-border bg-secondary/10 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors ${!selectedFolderId ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
              >
                <Folder className="size-3.5" />
                All Snippets
              </button>
              {data?.folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors ${selectedFolderId === folder.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  <Folder className="size-3.5" />
                  {folder.name}
                </button>
              ))}
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
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{snippet.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {snippet.language}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingSnippet(snippet)
                      }}
                    >
                      <Edit2 className="size-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredSnippets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
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
              onClick={() => setEditingSnippet({ name: '', content: '', language: 'markdown' })}
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
