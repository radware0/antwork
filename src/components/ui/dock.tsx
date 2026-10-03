import React, { useRef, type PropsWithChildren } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionProps, MotionStyle } from "motion/react"

import { cn } from "@/lib/utils"

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: "top" | "middle" | "bottom"
  children: React.ReactNode
}

const DEFAULT_SIZE = 40
const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false

const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity)

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (
          React.isValidElement<DockIconProps>(child) &&
          child.type === DockIcon
        ) {
          return React.cloneElement(child, {
            ...child.props,
            mouseX: mouseX,
            size: iconSize,
            magnification: iconMagnification,
            disableMagnification: disableMagnification,
            distance: iconDistance,
          })
        }
        return child
      })
    }

    return (
      <motion.div
        ref={ref}
        onPointerMove={(e) => mouseX.set(e.pointerType === "mouse" ? e.clientX : Infinity)}
        onPointerLeave={() => mouseX.set(Infinity)}
        {...props}
        className={cn(dockVariants({ className }), {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    )
  }
)

Dock.displayName = "Dock"

export interface DockIconProps extends Omit<
  MotionProps & React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  mouseX?: MotionValue<number>
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = ({
  size = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  disableMagnification,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className,
  children,
  style,
  onFocusCapture,
  onBlurCapture,
  onKeyDownCapture,
  onPointerDownCapture,
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const defaultMouseX = useMotionValue(Infinity)
  const keyboardFocused = useMotionValue(false)

  const active = useTransform((): number => {
    const x = (mouseX ?? defaultMouseX).get()
    const focused = keyboardFocused.get()
    const bounds = ref.current?.getBoundingClientRect()
    const hovered = bounds && Math.abs(x - bounds.x - bounds.width / 2) <= Math.min(distance, bounds.width / 2)
    return !disableMagnification && (focused || hovered) ? 1 : 0
  })

  const progress = useSpring(active, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })
  const scale = useTransform(progress, [0, 1], [1, magnification / size])
  const lift = useTransform(progress, value => `${-2 * value}px`)

  return (
    <motion.div
      ref={ref}
      style={{ width: "100%", height: 52, ...style,
        "--dock-icon-scale": scale, "--dock-icon-lift": lift,
      } as MotionStyle}
      className={cn(
        "flex items-center justify-center",
        className
      )}
      {...props}
      onFocusCapture={(event) => {
        keyboardFocused.set(event.target instanceof HTMLElement && event.target.matches(":focus-visible"))
        onFocusCapture?.(event)
      }}
      onBlurCapture={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) keyboardFocused.set(false)
        onBlurCapture?.(event)
      }}
      onKeyDownCapture={(event) => { keyboardFocused.set(true); onKeyDownCapture?.(event) }}
      onPointerDownCapture={(event) => { keyboardFocused.set(false); onPointerDownCapture?.(event) }}
    >
      <div className="dock-icon-inner">{children}</div>
    </motion.div>
  )
}

DockIcon.displayName = "DockIcon"

export { Dock, DockIcon, dockVariants }
