// frontend/src/heatmap/dimensions.js
/**
 * Helper function to calculate center offset
 * @param {number} lineBitmapWidth 
 * @returns {number}
 */
function centreOffset(lineBitmapWidth) {
  return Math.floor(lineBitmapWidth * 0.5);
}

/**
 * Calculates the position and width which will completely fill the space for the bar.
 * @param {number} xMedia - x coordinate of the bar defined in media sizing
 * @param {number} halfBarSpacingMedia - half the width of the current barSpacing
 * @param {number} horizontalPixelRatio - horizontal pixel ratio
 * @returns {{position: number, length: number}} Position and width for the bar
 */
export function fullBarWidth(xMedia, halfBarSpacingMedia, horizontalPixelRatio) {
  const fullWidthLeftMedia = xMedia - halfBarSpacingMedia;
  const fullWidthRightMedia = xMedia + halfBarSpacingMedia;
  const fullWidthLeftBitmap = Math.round(fullWidthLeftMedia * horizontalPixelRatio);
  const fullWidthRightBitmap = Math.round(fullWidthRightMedia * horizontalPixelRatio);
  const fullWidthBitmap = fullWidthRightBitmap - fullWidthLeftBitmap;
  return {
    position: fullWidthLeftBitmap,
    length: fullWidthBitmap,
  };
}

/**
 * Calculates the bitmap position for an item with a desired length, centered on position
 * @param {number} positionMedia - position coordinate (in media coordinates)
 * @param {number} pixelRatio - pixel ratio (horizontal for x, vertical for y)
 * @param {number} [desiredWidthMedia=1] - desired width in media coordinates
 * @param {boolean} [widthIsBitmap=false] - whether width is already in bitmap coordinates
 * @returns {{position: number, length: number}} Position and length
 */
export function positionsLine(positionMedia, pixelRatio, desiredWidthMedia = 1, widthIsBitmap = false) {
  const scaledPosition = Math.round(pixelRatio * positionMedia);
  const lineBitmapWidth = widthIsBitmap
    ? desiredWidthMedia
    : Math.round(desiredWidthMedia * pixelRatio);
  const offset = centreOffset(lineBitmapWidth);
  const position = scaledPosition - offset;
  return { position, length: lineBitmapWidth };
}

/**
 * Determines the bitmap position and length for a dimension of a shape
 * @param {number} position1Media - media coordinate for the first point
 * @param {number} position2Media - media coordinate for the second point
 * @param {number} pixelRatio - pixel ratio for the axis (vertical or horizontal)
 * @returns {{position: number, length: number}} Position and length
 */
export function positionsBox(position1Media, position2Media, pixelRatio) {
  const scaledPosition1 = Math.round(pixelRatio * position1Media);
  const scaledPosition2 = Math.round(pixelRatio * position2Media);
  return {
    position: Math.min(scaledPosition1, scaledPosition2),
    length: Math.abs(scaledPosition2 - scaledPosition1) + 1,
  };
} 