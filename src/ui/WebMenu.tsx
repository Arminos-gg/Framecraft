/**
 * The Web menu, opened from the ribbon on a page: things only a website has. A contact Form,
 * and Embeds that show a YouTube video or a map.
 */
import type { WebInsert } from '../editor/editor.ts';
import { useEditor } from './editor-context.ts';
import { ClassIcon, Icon } from './icons.tsx';
import { Popover } from './Popover.tsx';

const ITEMS: readonly (readonly [WebInsert, string, string])[] = [
  ['form', 'Form', 'Email, message and Send, for a form service'],
  ['video', 'YouTube video', 'Paste the video’s link'],
  ['map', 'Map', 'Type an address or a place'],
];

export function WebMenu({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const editor = useEditor();
  return (
    <Popover anchor={anchor} label="Add to the website" onClose={onClose}>
      <div className="pophead">
        Add to the website
        <span className="spacer" />
        <button className="ibtn sm" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="poplist" role="group" aria-label="Web objects">
        {ITEMS.map(([what, label, hint]) => (
          <button
            key={what}
            type="button"
            className="mi"
            data-web={what}
            onClick={() => {
              onClose();
              editor.insertWeb(what);
            }}
          >
            {what === 'map' ? (
              <span className="ico obj">
                <Icon name="map" />
              </span>
            ) : (
              <ClassIcon className={what === 'form' ? 'Form' : 'Embed'} />
            )}
            <span>{label}</span>
            <span className="d">{hint}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
