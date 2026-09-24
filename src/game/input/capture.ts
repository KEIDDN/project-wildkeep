/** Set while the Controls screen waits for a key, so the game ignores it. */
let capturing = false;

export const isCapturingInput = () => capturing;
export const setCapturingInput = (v: boolean) => {
  capturing = v;
};
