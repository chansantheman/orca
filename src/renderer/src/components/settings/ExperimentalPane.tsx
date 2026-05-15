import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { FolderIcon } from 'lucide-react'
import { useAppStore } from '../../store'
import { toast } from 'sonner'
import { SearchableSetting } from './SearchableSetting'
import { matchesSettingsSearch } from './settings-search'
import { EXPERIMENTAL_PANE_SEARCH_ENTRIES, EXPERIMENTAL_SEARCH_ENTRY } from './experimental-search'
import { HiddenExperimentalGroup } from './HiddenExperimentalGroup'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import type { MassCodeTriggerLocation } from '../../../../shared/types'

export { EXPERIMENTAL_PANE_SEARCH_ENTRIES }

type ExperimentalPaneProps = {
  /** Hidden-experimental group is only rendered once the user has unlocked
   *  it via Shift-clicking the Experimental sidebar entry. */
  hiddenExperimentalUnlocked?: boolean
}

export function ExperimentalPane({
  hiddenExperimentalUnlocked = false
}: ExperimentalPaneProps): React.JSX.Element {
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  if (!settings) {
    return <div />
  }
  const showPet = matchesSettingsSearch(searchQuery, [EXPERIMENTAL_SEARCH_ENTRY.pet])
  const showActivity = matchesSettingsSearch(searchQuery, [EXPERIMENTAL_SEARCH_ENTRY.activity])
  const showWorktreeSymlinks = matchesSettingsSearch(searchQuery, [
    EXPERIMENTAL_SEARCH_ENTRY.symlinks
  ])
  const showMasscode = matchesSettingsSearch(searchQuery, [EXPERIMENTAL_SEARCH_ENTRY.masscode])

  const toggleMassCode = async (enabled: boolean): Promise<void> => {
    const updates: Partial<typeof settings> = { experimentalMassCode: enabled }
    if (enabled && !settings.experimentalMassCodeVaultPath) {
      const detectedPath = await window.api.app.detectMassCodeVault()
      if (detectedPath) {
        await window.api.fs.authorizeExternalPath({ targetPath: detectedPath })
        updates.experimentalMassCodeVaultPath = detectedPath
        toast.success(`Detected massCode vault: ${detectedPath}`)
      }
    }
    await updateSettings(updates)
  }

  const pickMasscodeVault = async (): Promise<void> => {
    const path = await window.api.repos.pickDirectory()
    if (!path) {
      return
    }
    await window.api.fs.authorizeExternalPath({ targetPath: path })
    toast.success(`Selected vault: ${path}`)
    await updateSettings({ experimentalMassCodeVaultPath: path, experimentalMassCode: true })
  }

  return (
    <div className="space-y-4">
      {showMasscode ? (
        <SearchableSetting
          title="massCode Integration"
          description="Standalone snippet bridge for massCode (Markdown Vault)."
          keywords={EXPERIMENTAL_SEARCH_ENTRY.masscode.keywords}
          className="space-y-3 px-1 py-2"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 shrink space-y-1.5">
                <Label>massCode Integration</Label>
                <p className="text-xs text-muted-foreground">
                  Standalone snippet bridge for massCode (Markdown Vault). When enabled, a floating
                  massCode icon will appear in the bottom-right corner.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.experimentalMassCode}
                onClick={() => void toggleMassCode(!settings.experimentalMassCode)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
                  settings.experimentalMassCode ? 'bg-foreground' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
                    settings.experimentalMassCode ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {settings.experimentalMassCode ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="min-w-0 shrink space-y-1.5">
                  <Label>massCode Vault Path</Label>
                  <p className="text-xs text-muted-foreground">
                    The absolute path to your massCode Vault directory (v5+ Markdown format).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={settings.experimentalMassCodeVaultPath || ''}
                    placeholder="/Users/name/masscode-vault"
                    onChange={(e) =>
                      updateSettings({ experimentalMassCodeVaultPath: e.target.value })
                    }
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => void pickMasscodeVault()}
                    className="shrink-0"
                  >
                    <FolderIcon className="size-3.5" />
                  </Button>
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label>Snippet Preview Lines</Label>
                  <div className="flex items-center gap-4">
                    {[0, 1, 2].map((lines) => (
                      <label key={lines} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="masscode-preview-lines"
                          checked={settings.experimentalMassCodePreviewLines === lines}
                          onChange={() =>
                            updateSettings({ experimentalMassCodePreviewLines: lines })
                          }
                          className="size-3.5"
                        />
                        <span className="text-xs">
                          {lines === 0 ? 'None' : `${lines} line${lines > 1 ? 's' : ''}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <Label>Toggle Button Location</Label>
                  <ToggleGroup
                    type="single"
                    value={settings.massCodeTriggerLocation ?? 'floating-button'}
                    onValueChange={(value) => {
                      if (!value) {
                        return
                      }
                      void updateSettings({
                        massCodeTriggerLocation: value as MassCodeTriggerLocation
                      })
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="floating-button">Floating Button</ToggleGroupItem>
                    <ToggleGroupItem value="status-bar">Status Bar</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">
                    Choose where the massCode toggle icon is displayed.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </SearchableSetting>
      ) : null}
      {showPet ? (
        <SearchableSetting
          title="Pet"
          description="Floating animated pet in the bottom-right corner."
          keywords={EXPERIMENTAL_SEARCH_ENTRY.pet.keywords}
          className="space-y-3 px-1 py-2"
          id="experimental-pet"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 shrink space-y-1.5">
              <Label>Pet</Label>
              <p className="text-xs text-muted-foreground">
                Shows a small animated pet pinned to the bottom-right corner. Pick a character
                (Claudino, OpenCode, Gremlin) or upload your own PNG, APNG, GIF, WebP, JPG, or SVG
                from the status-bar pet menu. Hide it any time from the same menu without disabling
                this setting.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.experimentalPet}
              onClick={() => {
                updateSettings({ experimentalPet: !settings.experimentalPet })
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
                settings.experimentalPet ? 'bg-foreground' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
                  settings.experimentalPet ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </SearchableSetting>
      ) : null}

      {showActivity ? (
        <SearchableSetting
          title="Activity Page"
          description="Slack-style worktree activity feed for agent completions and blocking states."
          keywords={EXPERIMENTAL_SEARCH_ENTRY.activity.keywords}
          className="space-y-3 px-1 py-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 shrink space-y-0.5">
              <Label>Activity Page</Label>
              <p className="text-xs text-muted-foreground">
                Adds an Activity entry under Tasks with a threaded worktree feed for completed
                agents, blocking questions, unread state, and worktree creation events. Experimental
                — the event model and UI may change.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.experimentalActivity}
              onClick={() =>
                updateSettings({
                  experimentalActivity: !settings.experimentalActivity
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
                settings.experimentalActivity ? 'bg-foreground' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
                  settings.experimentalActivity ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </SearchableSetting>
      ) : null}

      {showWorktreeSymlinks ? (
        <SearchableSetting
          title="Symlinks on worktrees"
          description="Automatically symlink configured files or folders into newly created worktrees."
          keywords={EXPERIMENTAL_SEARCH_ENTRY.symlinks.keywords}
          className="space-y-3 px-1 py-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 shrink space-y-0.5">
              <Label>Symlinks on worktrees</Label>
              <p className="text-xs text-muted-foreground">
                Allows for automatic symlinks of certain folders or files that must be connected to
                created worktrees.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.experimentalWorktreeSymlinks}
              onClick={() =>
                updateSettings({
                  experimentalWorktreeSymlinks: !settings.experimentalWorktreeSymlinks
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
                settings.experimentalWorktreeSymlinks ? 'bg-foreground' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
                  settings.experimentalWorktreeSymlinks ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </SearchableSetting>
      ) : null}

      {hiddenExperimentalUnlocked ? <HiddenExperimentalGroup /> : null}
    </div>
  )
}
