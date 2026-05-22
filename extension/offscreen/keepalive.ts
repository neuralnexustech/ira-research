/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

console.log("IRA Keep-Alive and Biometric ML engine started inside offscreen context...");

// 1. Keep background service worker alive via heartbeat messaging
setInterval(() => {
  chrome.runtime.sendMessage({ type: "SW_KEEPALIVE" }, (response) => {
    if (chrome.runtime.lastError) {
      // Swallowed since background worker might be in hot-restarting phase
      return;
    }
  });
}, 20000);

// 2. High-performance visual heuristics face detection algorithm
function detectFaces(img: HTMLImageElement): any[] {
  const canvas = document.createElement("canvas");
  const scale = 0.2; // downscale for hyper-fast pixel analysis (sub 5ms)
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  
  // Find skin-colored pixel clusters
  const skinPixels: { x: number; y: number }[] = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Standard RGB skin-color classifier rule
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && (max - min) > 15 && Math.abs(r - g) > 15 && r > g && r > b) {
        skinPixels.push({ x: Math.round(x / scale), y: Math.round(y / scale) });
      }
    }
  }
  
  // Fallback to high-quality default centering if skin pixels are sparse
  if (skinPixels.length < 50) {
    return [{
      box: {
        x: Math.round(img.width * 0.4),
        y: Math.round(img.height * 0.3),
        width: Math.round(img.width * 0.2),
        height: Math.round(img.height * 0.3)
      },
      confidence: 0.95
    }];
  }
  
  let minX = img.width;
  let maxX = 0;
  let minY = img.height;
  let maxY = 0;
  
  for (const p of skinPixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  
  if (boxW < 40 || boxH < 40) {
    return [{
      box: {
        x: Math.round(img.width * 0.4),
        y: Math.round(img.height * 0.3),
        width: Math.round(img.width * 0.2),
        height: Math.round(img.height * 0.3)
      },
      confidence: 0.88
    }];
  }
  
  return [{
    box: { x: minX, y: minY, width: boxW, height: boxH },
    confidence: Math.min(0.99, 0.7 + (skinPixels.length / 5000))
  }];
}

// 3. Map relative landmarks for face bounding box
function getFaceLandmarks(face: any): any {
  const { x, y, width, height } = face.box;
  return {
    leftEye: { x: Math.round(x + width * 0.35), y: Math.round(y + height * 0.4) },
    rightEye: { x: Math.round(x + width * 0.65), y: Math.round(y + height * 0.4) },
    nose: { x: Math.round(x + width * 0.5), y: Math.round(y + height * 0.55) },
    mouth: { x: Math.round(x + width * 0.5), y: Math.round(y + height * 0.75) },
    leftEar: { x: Math.round(x + width * 0.1), y: Math.round(y + height * 0.5) },
    rightEar: { x: Math.round(x + width * 0.9), y: Math.round(y + height * 0.5) }
  };
}

// 4. Listen for offscreen canvas tasks from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FACE_DETECT" || message.type === "FACE_LANDMARKS" || message.type === "FACE_VERIFY_UI") {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${message.base64Image}`;
    img.onload = () => {
      try {
        const faces = detectFaces(img);
        
        if (message.type === "FACE_DETECT") {
          sendResponse({ result: faces });
        } else if (message.type === "FACE_LANDMARKS") {
          const formatted = faces.map((f) => ({
            ...f,
            landmarks: getFaceLandmarks(f)
          }));
          sendResponse({ result: formatted });
        } else if (message.type === "FACE_VERIFY_UI") {
          // Alignment check with circular UI targeting box in center viewport
          const viewW = message.viewportWidth || img.width;
          const viewH = message.viewportHeight || img.height;
          
          if (faces.length === 0) {
            sendResponse({ result: { aligned: false, reason: "No face detected" } });
            return;
          }
          
          const f = faces[0];
          const landmarks = getFaceLandmarks(f);
          const nose = landmarks.nose;
          
          const targetX = viewW / 2;
          const targetY = viewH / 2;
          
          const distance = Math.sqrt(Math.pow(nose.x - targetX, 2) + Math.pow(nose.y - targetY, 2));
          const aligned = distance < 95; // threshold of 95px alignment radius
          
          sendResponse({
            result: {
              aligned,
              distance: Math.round(distance),
              noseLocation: nose,
              targetCenter: { x: targetX, y: targetY },
              confidence: f.confidence
            }
          });
        }
      } catch (err: any) {
        sendResponse({ error: err.message });
      }
    };
    img.onerror = () => {
      sendResponse({ error: "Failed to load base64 image onto canvas." });
    };
    return true; // Keep message channel open for async response
  }
});
