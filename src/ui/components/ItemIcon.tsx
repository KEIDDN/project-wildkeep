import { RARITY_COLOR, type Rarity } from "../../game/core/types";

interface ItemIconProps {
  icon: string;
  rarity: Rarity;
  quantity?: number;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}

export function ItemIcon({
  icon,
  rarity,
  quantity,
  size = 40,
  selected,
  onClick,
  title,
}: ItemIconProps) {
  return (
    <button
      className={`item-icon${selected ? " selected" : ""}`}
      style={{ width: size, height: size, borderColor: RARITY_COLOR[rarity] }}
      onClick={onClick}
      title={title}
      type="button"
    >
      <img src={icon} alt="" draggable={false} />
      {quantity !== undefined && quantity > 1 && (
        <span className="item-qty">{quantity}</span>
      )}
    </button>
  );
}
