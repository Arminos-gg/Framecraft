/** Small helpers the starter templates share. */
import type { Builder } from '../builder.ts';
import type { PropsOf } from '../classes.ts';
import type { InstanceId } from '../document.ts';
import type { Color3, UDim, UDim2 } from '../values.ts';

/** A TextLabel with no background, the most common object in every template. */
export const label = (b: Builder, parent: InstanceId, props: Partial<PropsOf<'TextLabel'>>) =>
  b.add(parent, 'TextLabel', { BackgroundTransparency: 1, ...props });

/** An invisible Frame that only groups and places its children. */
export const group = (b: Builder, parent: InstanceId, props: Partial<PropsOf<'Frame'>>) =>
  b.add(parent, 'Frame', { BackgroundTransparency: 1, ...props });

export const corner = (b: Builder, id: InstanceId, radius: UDim) =>
  b.add(id, 'UICorner', { CornerRadius: radius });

export const stroke = (
  b: Builder,
  id: InstanceId,
  color: Color3,
  thickness = 1,
  props: Partial<PropsOf<'UIStroke'>> = {},
) => b.add(id, 'UIStroke', { Color: color, Thickness: thickness, ...props });

/** The same padding on every side. */
export const padAll = (b: Builder, id: InstanceId, pad: UDim) =>
  b.add(id, 'UIPadding', {
    PaddingTop: pad,
    PaddingBottom: pad,
    PaddingLeft: pad,
    PaddingRight: pad,
  });

/** Room on the left and right, so text that grows the box keeps clear of its edges. */
export const padX = (b: Builder, id: InstanceId, pad: number) =>
  b.add(id, 'UIPadding', { PaddingLeft: [0, pad], PaddingRight: [0, pad] });

export const square = (b: Builder, id: InstanceId) =>
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 1 });

/** Sizes for Desktop and, where they differ, Tablet and Phone. */
export interface Responsive {
  readonly base: UDim2;
  readonly Tablet?: UDim2;
  readonly Phone?: UDim2;
}

/** Sets an object's Size at Desktop and changes it at Tablet and Phone. */
export function sizeAt(b: Builder, id: InstanceId, size: Responsive) {
  b.set(id, { Size: size.base });
  if (size.Tablet) b.change(id, 'Tablet', { Size: size.Tablet });
  if (size.Phone) b.change(id, 'Phone', { Size: size.Phone });
}

/**
 * A web page's content column, centered in its section: a fixed width on Desktop and the
 * window less a margin on Tablet and Phone.
 */
export function column(
  b: Builder,
  section: InstanceId,
  width: number,
  height: UDim = [1, 0],
  name = 'Content',
) {
  const id = group(b, section, {
    Name: name,
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 0],
  });
  sizeAt(b, id, {
    base: [0, width, ...height],
    Tablet: [1, -80, ...height],
    Phone: [1, -40, ...height],
  });
  return id;
}
