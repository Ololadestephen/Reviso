import { createAvatar } from "@dicebear/core";
import * as funEmoji from "@dicebear/fun-emoji";

/**
 * Illustrated face card from DiceBear Fun Emoji (Davis Uche, CC BY 4.0).
 * Generated locally from the account id. Same id always gets the same face.
 */
export function accountFace(userId: string) {
  return createAvatar(funEmoji, {
    seed: userId,
    size: 64,
    radius: 12,
  }).toDataUri();
}
