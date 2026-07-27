/**
 * Canvas drawing for the field and the next-pair preview.
 * Takes a flat list of sprites so the caller can mix settled, falling and popping puyos.
 * Plain script (no bundler) — exposed as window.PuyoRender.
 */
(function (global) {
  'use strict';

  var PALETTE = {
    red: { base: '#ff4d5e', light: '#ffa8b0', dark: '#b8122a' },
    green: { base: '#49cf5b', light: '#a6eeae', dark: '#1c8730' },
    blue: { base: '#3f9dff', light: '#a3ccff', dark: '#1152b4' },
    yellow: { base: '#ffc41f', light: '#ffe694', dark: '#bd8400' },
    purple: { base: '#b56bff', light: '#ddb9ff', dark: '#6f22c0' },
    garbage: { base: '#c9d1dc', light: '#f8fbff', dark: '#6d7582' },
  };

  function paletteFor(color) {
    return PALETTE[color] || PALETTE.red;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** Blobby bridge toward a same-colour neighbour, drawn under the bodies. */
  function drawConnection(ctx, cx, cy, cell, color, dRow, dCol) {
    var thickness = cell * 0.52;
    var reach = cell * 0.62;
    ctx.fillStyle = paletteFor(color).base;
    if (dCol !== 0) {
      var x = dCol > 0 ? cx : cx - reach;
      ctx.fillRect(x, cy - thickness / 2, reach, thickness);
    } else {
      var y = dRow > 0 ? cy : cy - reach;
      ctx.fillRect(cx - thickness / 2, y, thickness, reach);
    }
  }

  function drawBody(ctx, cx, cy, radius, color) {
    var pal = paletteFor(color);
    var gradient = ctx.createRadialGradient(
      cx - radius * 0.35, cy - radius * 0.4, radius * 0.15,
      cx, cy, radius * 1.05
    );
    gradient.addColorStop(0, pal.light);
    gradient.addColorStop(0.55, pal.base);
    gradient.addColorStop(1, pal.dark);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.34, cy - radius * 0.44, radius * 0.26, radius * 0.17, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEyes(ctx, cx, cy, radius) {
    var offsetX = radius * 0.33;
    var offsetY = -radius * 0.05;
    var eyeR = radius * 0.27;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - offsetX, cy + offsetY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + offsetX, cy + offsetY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20142c';
    ctx.beginPath();
    ctx.arc(cx - offsetX, cy + offsetY + eyeR * 0.18, eyeR * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + offsetX, cy + offsetY + eyeR * 0.18, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * sprites: { row, col, color, alpha?, scale?, connect?, eyes? } with row/col in board
   * coordinates (row may be fractional while falling). Rows above hiddenRows are clipped away.
   */
  function drawSprites(ctx, sprites, cell, hiddenRows) {
    var connectable = {};
    sprites.forEach(function (sprite) {
      if (sprite.connect === false) return;
      if (sprite.row !== Math.round(sprite.row) || sprite.col !== Math.round(sprite.col)) return;
      connectable[sprite.row + ',' + sprite.col] = sprite;
    });

    sprites.forEach(function (sprite) {
      var x = sprite.col * cell;
      var y = (sprite.row - hiddenRows) * cell;
      var cx = x + cell / 2;
      var cy = y + cell / 2;
      var scale = sprite.scale === undefined ? 1 : sprite.scale;
      var alpha = sprite.alpha === undefined ? 1 : sprite.alpha;
      if (alpha <= 0 || scale <= 0) return;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (sprite.connect !== false && scale >= 0.999) {
        var neighbours = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (var i = 0; i < neighbours.length; i += 1) {
          var key = (sprite.row + neighbours[i][0]) + ',' + (sprite.col + neighbours[i][1]);
          var other = connectable[key];
          if (other && other.color === sprite.color) {
            drawConnection(ctx, cx, cy, cell, sprite.color, neighbours[i][0], neighbours[i][1]);
          }
        }
      }

      drawBody(ctx, cx, cy, cell * 0.46 * scale, sprite.color);
      if (sprite.eyes !== false) drawEyes(ctx, cx, cy, cell * 0.46 * scale);
      ctx.restore();
    });
  }

  function drawFieldBackground(ctx, cols, rows, cell) {
    var width = cols * cell;
    var height = rows * cell;
    ctx.clearRect(0, 0, width, height);

    var backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#1b1440');
    backdrop.addColorStop(1, '#120d2c');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (var c = 1; c < cols; c += 1) {
      ctx.beginPath();
      ctx.moveTo(c * cell + 0.5, 0);
      ctx.lineTo(c * cell + 0.5, height);
      ctx.stroke();
    }
    for (var r = 1; r < rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(0, r * cell + 0.5);
      ctx.lineTo(width, r * cell + 0.5);
      ctx.stroke();
    }
  }

  /** Shades the hidden buffer row and marks the death cell, so danger is visible early. */
  function drawFieldMarkers(ctx, cols, hiddenRows, spawnCol, cell) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, cols * cell, hiddenRows * cell);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, hiddenRows * cell + 0.5);
    ctx.lineTo(cols * cell, hiddenRows * cell + 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 120, 160, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(spawnCol * cell + 0.5, hiddenRows * cell + 0.5, cell - 1, cell - 1);
    ctx.restore();
  }

  /** Dashed outline showing where the pair will land. */
  function drawGhost(ctx, cells, cell, hiddenRows) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    cells.forEach(function (item) {
      var y = (item.row - hiddenRows) * cell;
      ctx.beginPath();
      ctx.arc(item.col * cell + cell / 2, y + cell / 2, cell * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  /** Small standalone pair used by the Next preview; child on top, axis below. */
  function drawPreviewPair(ctx, x, y, cell, pair) {
    var pad = cell * 0.1;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    roundRect(ctx, x - pad, y - pad, cell + pad * 2, cell * 2 + pad * 2, cell * 0.3);
    ctx.fill();
    ctx.translate(x, y);
    drawSprites(
      ctx,
      [
        { row: 0, col: 0, color: pair.child, connect: false },
        { row: 1, col: 0, color: pair.axis, connect: false },
      ],
      cell,
      0
    );
    ctx.restore();
  }

  global.PuyoRender = {
    PALETTE: PALETTE,
    drawFieldBackground: drawFieldBackground,
    drawFieldMarkers: drawFieldMarkers,
    drawGhost: drawGhost,
    drawSprites: drawSprites,
    drawPreviewPair: drawPreviewPair,
    roundRect: roundRect,
  };
})(window);
