/**
 * Icon — renders any lucide icon and lets `className` control colour (`text-*`) and inherits the
 * surrounding text colour from {@link TextClassContext}, so icons inside a Button match its label.
 * @module primitives/icon
 */
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { cn } from '../lib/cn';
import { TextClassContext } from './text';

type IconImplProps = LucideProps & { as: LucideIcon };

function IconImpl({ as: IconComponent, ...props }: IconImplProps) {
  return <IconComponent {...props} />;
}

// Teach NativeWind to turn `text-*` classes into the icon's `color` prop.
cssInterop(IconImpl, {
  className: { target: 'style', nativeStyleToProp: { color: true, opacity: true } },
});

/** Props for {@link Icon}. */
export type IconProps = Omit<LucideProps, 'ref'> & { as: LucideIcon; className?: string };

/**
 * Lucide icon with design-system colour handling.
 * @param props - `as` is the lucide icon component (e.g. `Plus`); `size` is in px, default 16 (see the `size.icon.*` tokens).
 * @example
 * <Icon as={Plus} size={20} className="text-primary" />
 */
export function Icon({ as, className, size = 16, ...props }: IconProps) {
  const inherited = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={as}
      size={size}
      className={cn('text-foreground', inherited, className)}
      // Decorative by default; pass accessibilityLabel/role when the icon carries meaning.
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}
