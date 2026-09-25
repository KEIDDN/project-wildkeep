import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { getItem } from "../../data/items";
import { RARITY_COLOR } from "../../game/core/types";
import { itemName } from "../../i18n/content";
import { t } from "../../i18n";
import { wearState } from "../../game/systems/durability";

interface ItemIconProps {
  itemId: string;
  quantity?: number;
  size?: number;
  selected?: boolean;
  equipped?: boolean;
  stolen?: boolean;
  dim?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  /** Durability to show as a thin bar (gear only). */
  dur?: { cur: number; max: number } | null;
  /** Drag & drop (see DragItem): press handler and this slot's drop id. */
  onPointerDown?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  dropId?: string;
}

/** Item slot with rarity-coloured frame and glow (stronger for rarer items). */
export function ItemIcon({ itemId, quantity, size = 48, selected, equipped, stolen, dim, onClick, onDoubleClick, dur, onPointerDown, onContextMenu, dropId }: ItemIconProps) {
  const def = getItem(itemId);
  const color = RARITY_COLOR[def.rarity];
  const name = itemName(itemId);
  return (
    <button
      type="button"
      className={`slot rarity-${def.rarity}${selected ? " selected" : ""}${dim ? " dim" : ""}${stolen ? " stolen" : ""}`}
      style={{ width: size, height: size, ["--rarity" as string]: color }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      data-drop={dropId}
      title={`${name} (${t(`common.rarity.${def.rarity}`)})${stolen ? ` · ${t("inventory.stolenTag")}` : ""}`}
    >
      <img src={`/icons/${def.icon}.png`} alt={name} draggable={false} />
      {quantity !== undefined && quantity > 1 && <span className="slot-qty">{quantity}</span>}
      {equipped && <span className="slot-badge">E</span>}
      {stolen && <span className="slot-stolen" />}
      {def.keyItem && <span className="slot-key" />}
      {dur && dur.max > 0 && dur.cur < dur.max && (
        <span className={`wearbar wear-${wearState(dur.cur, dur.max)}`}>
          <i style={{ width: `${(dur.cur / dur.max) * 100}%` }} />
        </span>
      )}
    </button>
  );
}

export function EmptySlot({ size = 48, label, ghost, dropId }: { size?: number; label?: string; ghost?: string; dropId?: string }) {
  return (
    <div className="slot empty" style={{ width: size, height: size }} data-drop={dropId}>
      {ghost && <img className="slot-ghost" src={`/icons/${ghost}.png`} alt="" draggable={false} />}
      {label && <span className="slot-label">{label}</span>}
    </div>
  );
}
