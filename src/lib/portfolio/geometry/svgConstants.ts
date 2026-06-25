/**
 * ValueChart SVG coordinate system constants.
 * These are viewBox units, not CSS pixels.
 */

export const VB_W = 600;
export const VB_H = 200;

export const PAD_X = 0; // Area chart usually bleeds to edges
export const PAD_Y_TOP = 20;
export const PAD_Y_BOT = 10;

export const DRAW_W = VB_W - PAD_X * 2;
export const DRAW_H = VB_H - PAD_Y_TOP - PAD_Y_BOT;
