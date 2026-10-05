import { SidePanel } from './Panel.tsx';

interface ExplorerProps {
  open: boolean;
  onClose: () => void;
}

export function Explorer({ open, onClose }: ExplorerProps) {
  return (
    <SidePanel title="Explorer" className="explorer" open={open} onClose={onClose}>
      <p className="empty">Nothing here yet. Objects you insert will show up in this tree.</p>
    </SidePanel>
  );
}
