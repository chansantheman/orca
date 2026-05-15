import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function FloatingMassCodeToggleButton({
  open,
  onToggle
}: {
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div className="fixed bottom-8 right-14 z-40">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-border bg-secondary text-secondary-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
            data-floating-masscode-toggle
            aria-label={open ? 'Close massCode snippets' : 'Show massCode snippets'}
            aria-pressed={open}
            onClick={onToggle}
          >
            <ClipboardList className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          sideOffset={6}
        >{`${open ? 'Close' : 'Show'} massCode snippets`}</TooltipContent>
      </Tooltip>
    </div>
  )
}
