import * as React from 'react';
import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { cn } from '@/lib/utils';

export function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn('ant-avatar isolate', className)} {...props} />;
}

export function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn('ant-avatar-image', className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={cn('ant-avatar-fallback', className)} {...props} />;
}
