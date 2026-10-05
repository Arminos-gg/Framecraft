import { SidePanel } from './Panel.tsx';

interface PropertiesProps {
  open: boolean;
  onClose: () => void;
}

export function Properties({ open, onClose }: PropertiesProps) {
  return (
    <SidePanel title="Properties" className="props" open={open} onClose={onClose}>
      <p className="empty">Select an object to see its properties.</p>
    </SidePanel>
  );
}
