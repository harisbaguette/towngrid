import type { ComponentProps, ReactNode } from 'react';
import { Check, CircleAlert, Cog, Lock, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function GamePanel({ title, icon, onClose, children, className, ...props }: Omit<ComponentProps<'section'>, 'title'> & { title?: ReactNode; icon?: ReactNode; onClose?: () => void }) {
  return <section className={cn('ui-frame', className)} {...props}>
    {title && <header className="ui-frame-heading"><h2>{icon}{title}</h2>{onClose && <Button size="icon-sm" variant="secondary" aria-label="닫기" onClick={onClose}><X size={18}/></Button>}</header>}
    <div className="ui-frame-body">{children}</div>
  </section>;
}

export function StatusBadge({ tone = 'success', children, className, ...props }: ComponentProps<'span'> & { tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral' }) {
  const Icon = tone === 'success' ? Cog : tone === 'info' ? Truck : tone === 'neutral' ? Lock : CircleAlert;
  return <span className={cn('ui-status', className)} data-tone={tone} {...props}><Icon size={14} aria-hidden/>{children}</span>;
}

export function ResourceCounter({ icon, label, value, className, ...props }: ComponentProps<'button'> & { icon: ReactNode; label: string; value: string | number }) {
  return <button type="button" className={cn('ui-resource', className)} aria-label={label + ' ' + value} {...props}>{icon}<strong>{value}</strong></button>;
}

export function BuildingCard({ name, image, price, selected = false, locked = false, lockReason = '잠김', built = false, children, className, disabled, ...props }: Omit<ComponentProps<'button'>, 'name'> & { name: string; image: string; price: ReactNode; selected?: boolean; locked?: boolean; lockReason?: string; built?: boolean }) {
  return <button type="button" className={cn('build-item', selected && 'selected', built && 'built', className)} aria-pressed={selected} disabled={locked || built || disabled} data-locked={locked || undefined} {...props}>
    <strong>{name}</strong><img src={image} alt="" draggable={false}/>
    {selected && <span className="build-state" aria-hidden><Check size={15}/></span>}
    {locked && <span className="build-lock" aria-hidden><Lock size={22}/></span>}
    {children}
    <span className={cn('item-price', locked && !built && 'item-lock')}>{built ? <><Check size={13}/>건설됨</> : locked ? <><Lock size={13}/>{lockReason}</> : price}</span>
  </button>;
}
