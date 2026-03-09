(function () {
  function cosineSimilarity(a, b) {
    const x = Array.isArray(a) ? a : [];
    const y = Array.isArray(b) ? b : [];
    const n = Math.min(x.length, y.length);
    if (!n) return 0;
    let dot = 0;
    let ax = 0;
    let by = 0;
    for (let i = 0; i < n; i += 1) {
      const xv = Number(x[i] || 0);
      const yv = Number(y[i] || 0);
      dot += xv * yv;
      ax += xv * xv;
      by += yv * yv;
    }
    if (ax <= 0 || by <= 0) return 0;
    return dot / (Math.sqrt(ax) * Math.sqrt(by));
  }

  function averageVectors(vectors) {
    const src = Array.isArray(vectors) ? vectors.filter(Array.isArray) : [];
    if (!src.length) return [];
    const len = src[0].length;
    if (!len) return [];
    const out = new Array(len).fill(0);
    for (let i = 0; i < src.length; i += 1) {
      const v = src[i];
      for (let j = 0; j < len; j += 1) out[j] += Number(v[j] || 0);
    }
    for (let k = 0; k < len; k += 1) out[k] = out[k] / src.length;
    return out;
  }

  function extractFaceVector(videoEl, canvasEl, face) {
    if (!videoEl || !canvasEl || !face || !face.boundingBox) return [];
    const box = face.boundingBox;
    const vw = Number(videoEl.videoWidth || 0);
    const vh = Number(videoEl.videoHeight || 0);
    if (vw < 16 || vh < 16) return [];

    const sx = Math.max(0, Math.floor(box.x));
    const sy = Math.max(0, Math.floor(box.y));
    const sw = Math.max(8, Math.floor(box.width));
    const sh = Math.max(8, Math.floor(box.height));

    canvasEl.width = 48;
    canvasEl.height = 48;
    const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    try {
      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 48, 48);
      const img = ctx.getImageData(0, 0, 48, 48);
      const data = img.data;
      const vector = [];
      for (let by = 0; by < 8; by += 1) {
        for (let bx = 0; bx < 8; bx += 1) {
          let sum = 0;
          let count = 0;
          const y0 = by * 6;
          const x0 = bx * 6;
          for (let y = y0; y < y0 + 6; y += 1) {
            for (let x = x0; x < x0 + 6; x += 1) {
              const i = (y * 48 + x) * 4;
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              sum += gray / 255;
              count += 1;
            }
          }
          vector.push(count ? (sum / count) : 0);
        }
      }
      vector.push(Math.min(1, Math.max(0, box.width / vw)));
      vector.push(Math.min(1, Math.max(0, box.height / vh)));
      vector.push(Math.min(1, Math.max(0, (box.x + (box.width / 2)) / vw)));
      vector.push(Math.min(1, Math.max(0, (box.y + (box.height / 2)) / vh)));
      return vector;
    } catch (e) {
      return [];
    }
  }

  function findBestMatch(vector, indexRows) {
    const input = Array.isArray(vector) ? vector : [];
    const rows = Array.isArray(indexRows) ? indexRows : [];
    if (!input.length || !rows.length) return null;
    let best = null;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const score = cosineSimilarity(input, row.vector);
      if (!best || score > best.score) {
        best = {
          profileFile: row.profileFile,
          username: row.username,
          score: score,
          profile: row.profile || null,
        };
      }
    }
    return best;
  }

  function summarizeLandmarks(face, vw, vh) {
    const rows = [];
    const points = face && Array.isArray(face.landmarks) ? face.landmarks : [];
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      rows.push({
        x: Math.min(1, Math.max(0, Number(p.x || 0) / Math.max(1, vw))),
        y: Math.min(1, Math.max(0, Number(p.y || 0) / Math.max(1, vh))),
        type: String(p.type || ""),
      });
    }
    return rows;
  }

  function computeGeometry(face, landmarks, vw, vh) {
    const box = face && face.boundingBox ? face.boundingBox : { x: 0, y: 0, width: 1, height: 1 };
    const aspect = Number(box.height || 1) > 0 ? (Number(box.width || 1) / Number(box.height || 1)) : 1;
    const eyePoints = landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("eye"); });
    let eyeSpacing = 0;
    if (eyePoints.length >= 2) {
      const a = eyePoints[0];
      const b = eyePoints[eyePoints.length - 1];
      eyeSpacing = Math.hypot(a.x - b.x, a.y - b.y);
    }
    return {
      facial_landmark_points: landmarks.slice(0, 200),
      eye_spacing_and_shape: {
        eye_spacing_ratio: eyeSpacing,
        eye_points_count: eyePoints.length,
      },
      eyebrow_structure: {
        eyebrow_points_count: landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("brow"); }).length,
      },
      nose_geometry: {
        nose_points_count: landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("nose"); }).length,
      },
      jawline_contours: {
        jaw_points_count: landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("jaw"); }).length,
      },
      lip_structure: {
        lip_points_count: landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("mouth") || String(p.type || "").toLowerCase().includes("lip"); }).length,
      },
      cheekbone_geometry: {
        cheek_points_count: landmarks.filter(function (p) { return String(p.type || "").toLowerCase().includes("cheek"); }).length,
      },
      facial_symmetry_ratios: {
        width_height_ratio: aspect,
        center_x_ratio: Math.min(1, Math.max(0, (Number(box.x || 0) + (Number(box.width || 0) / 2)) / Math.max(1, vw))),
        center_y_ratio: Math.min(1, Math.max(0, (Number(box.y || 0) + (Number(box.height || 0) / 2)) / Math.max(1, vh))),
      },
      skin_texture_patterns: {
        texture_basis: "pixel_block_intensity_distribution",
      },
      micro_feature_spacing: {
        normalized_landmark_distances: landmarks.slice(0, 60),
      },
      pixel_level_geometry_of_face: {
        crop_width_ratio: Math.min(1, Math.max(0, Number(box.width || 0) / Math.max(1, vw))),
        crop_height_ratio: Math.min(1, Math.max(0, Number(box.height || 0) / Math.max(1, vh))),
      },
    };
  }

  function extractFaceSignature(videoEl, canvasEl, face) {
    const vector = extractFaceVector(videoEl, canvasEl, face);
    const vw = Number(videoEl && videoEl.videoWidth ? videoEl.videoWidth : 1);
    const vh = Number(videoEl && videoEl.videoHeight ? videoEl.videoHeight : 1);
    const landmarks = summarizeLandmarks(face, vw, vh);
    const geometry = computeGeometry(face, landmarks, vw, vh);
    return {
      feature_vector: vector,
      landmarks: landmarks,
      geometry: geometry,
    };
  }

  window.PI_VIS_RECOGNITION = {
    cosineSimilarity: cosineSimilarity,
    averageVectors: averageVectors,
    extractFaceVector: extractFaceVector,
    extractFaceSignature: extractFaceSignature,
    findBestMatch: findBestMatch,
  };
})();
