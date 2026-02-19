import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {React.Children.map(children, child => {
          if (child?.type === DialogContent) return React.cloneElement(child, { onClose: () => onOpenChange(false) })
          return child
        })}
      </div>
    </div>,
    document.body
  )
}

const DialogContent = React.forwardRef(({ className, children, onClose, ...props }, ref) => (
  <div ref={ref} className={cn('relative z-50 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg max-h-[85vh] overflow-y-auto', className)} {...props}>
    <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={onClose}>
      <X className="h-4 w-4" /><span className="sr-only">Close</span>
    </button>
    {children}
  </div>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }) => <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />)
DialogTitle.displayName = 'DialogTitle'
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'
const DialogFooter = ({ className, ...props }) => <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4', className)} {...props} />

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
