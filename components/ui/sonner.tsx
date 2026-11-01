"use client"

import { Toaster as SonnerToaster, toast } from "sonner"

function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="system"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "font-semibold",
          description: "text-sm",
        },
      }}
    />
  )
}

export { Toaster, toast }
