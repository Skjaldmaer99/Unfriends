"use client"

import type { ReactNode } from "react"
import {
  Dialog as DialogPrimitive,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  type DialogProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

interface DialogContentProps {
  children: ReactNode
  className?: string
  isDismissable?: boolean
  isKeyboardDismissDisabled?: boolean
}

function DialogContent({
  children,
  className,
  isDismissable = true,
  isKeyboardDismissDisabled = false,
}: DialogContentProps) {
  return (
    <ModalOverlay
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/35 p-4 backdrop-blur-[2px]",
          isEntering && "animate-in duration-150 fade-in",
          isExiting && "animate-out duration-100 fade-out"
        )
      }
    >
      <Modal className="w-full max-w-md outline-none">
        <DialogPrimitive
          className={cn(
            "rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6",
            className
          )}
        >
          {children}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Heading>) {
  return (
    <Heading
      slot="title"
      className={cn("font-heading text-xl font-bold", className)}
      {...props}
    />
  )
}

export { DialogContent, DialogTitle, DialogTrigger }
export type { DialogProps }
